import {
  CommDeviceMode,
  DataObject,
  type YacaClient,
  YacaFilterEnum,
  YacaNotificationType,
  YacaPlayerData,
  type YacaProtocol,
  YacaResponse,
  type YacaSharedConfig,
  YacaStereoMode,
} from "types";
import { WebSocket, calculateDistanceVec3, convertNumberArrayToXYZ, getCamDirection, clamp, vehicleHasOpening } from "utils";
import { YaCAClientIntercomModule, YaCAClientMegaphoneModule, YaCAClientPhoneModule, YaCAClientRadioModule, localLipSyncAnimations } from "yaca";
import { YaCAClientSaltyChatBridge } from "../bridge/saltychat";
import { initLocale, locale } from "common/locale";
import { cache } from "../utils";

/**
 * The YaCA client module.
 * This module is responsible for handling the client side of the voice plugin.
 * It also handles the websocket connection to the voice plugin.
 */
export class YaCAClientModule {
  websocket: WebSocket;
  sharedConfig: YacaSharedConfig;
  allPlayers: Map<number, YacaPlayerData> = new Map();
  firstConnect = true;

  radioModule: YaCAClientRadioModule;
  phoneModule: YaCAClientPhoneModule;
  megaphoneModule: YaCAClientMegaphoneModule;
  intercomModule: YaCAClientIntercomModule;

  saltyChatBridge?: YaCAClientSaltyChatBridge;

  canChangeVoiceRange = true;
  rangeIndex: number;
  rangeInterval: CitizenTimer | null = null;
  visualVoiceRangeTimeout: CitizenTimer | null = null;
  visualVoiceRangeTick: CitizenTimer | null = null;

  isTalking = false;
  isPlayerMuted = false;
  useWhisper = false;

  currentlyPhoneSpeakerApplied: Set<number> = new Set();
  currentlySendingPhoneSpeakerSender: Set<number> = new Set();

  responseCodesToErrorMessages: { [key: string]: string | undefined };

  /**
   * Sends a radar notification.
   *
   * @param {string} message - The message to be sent in the notification.
   * @param {YacaNotificationType} type - The type of the notification, e.g. error, inform, success.
   */
  notification(message: string, type: YacaNotificationType) {
    if (this.sharedConfig.notifications.oxLib) {
      emit("ox_lib:notify", {
        id: "yaca",
        title: "YaCA",
        description: message,
        type,
      });
    }

    if (this.sharedConfig.notifications.gta) {
      BeginTextCommandThefeedPost("STRING");
      AddTextComponentSubstringPlayerName(`YaCA: ${message}`);
      if (type === YacaNotificationType.ERROR) {
        ThefeedSetNextPostBackgroundColor(6);
      }
      EndTextCommandThefeedPostTicker(false, false);
    }
  }

  constructor() {
    this.sharedConfig = JSON.parse(LoadResourceFile(cache.resource, "config/shared.json"));
    initLocale(this.sharedConfig.locale);

    this.responseCodesToErrorMessages = {
      OUTDATED_VERSION: locale("outdated_plugin"),
      WRONG_TS_SERVER: locale("wrong_ts_server"),
      NOT_CONNECTED: locale("not_connected"),
      MOVE_ERROR: locale("move_error"),
      WAIT_GAME_INIT: "",
      HEARTBEAT: "",
    };

    this.websocket = new WebSocket();

    /**
     * Register the NUI callback types.
     */
    RegisterNuiCallbackType("YACA_OnNuiReady");
    on("__cfx_nui:YACA_OnNuiReady", (_: unknown, cb: (data: unknown) => void) => {
      this.websocket.nuiReady = true;
      setTimeout(() => {
        emitNet("server:yaca:nuiReady");
      }, 5000);
      cb({});
    });

    this.rangeIndex = this.sharedConfig.voiceRange.defaultIndex ?? 0;

    this.registerExports();
    this.registerEvents();
    this.registerKeybindings();

    this.intercomModule = new YaCAClientIntercomModule(this);
    this.megaphoneModule = new YaCAClientMegaphoneModule(this);
    this.phoneModule = new YaCAClientPhoneModule(this);
    this.radioModule = new YaCAClientRadioModule(this);

    /**
     * Add a state bag change handler for the "yaca:lipsync" state bag.
     * Which is used to override the talking state of the player.
     */
    AddStateBagChangeHandler("yaca:lipsync", "", (bagName: string, _: string, value: boolean, __: number, replicated: boolean) => {
      if (replicated) {
        return;
      }

      const playerId = GetPlayerFromStateBagName(bagName);
      if (playerId === 0) {
        return;
      }

      SetPlayerTalkingOverride(playerId, value);
    });

    if (this.sharedConfig.saltyChatBridge) {
      this.sharedConfig.maxRadioChannels = 2;
      this.saltyChatBridge = new YaCAClientSaltyChatBridge(this);
    }

    console.log("[Client] YaCA Client loaded.");
  }

  registerExports() {
    /**
     * Get the current voice range.
     *
     * @returns {number} The current voice range.
     */
    exports("getVoiceRange", () => this.getVoiceRange());

    /**
     * Get all voice ranges.
     *
     * @returns {number[]}
     */
    exports("getVoiceRanges", () => this.sharedConfig.voiceRange.ranges);
  }

  /**
   * Registers the keybindings for the plugin.
   */
  registerKeybindings() {
    if (this.sharedConfig.keyBinds.toggleRange === false) {
      return;
    }

    /**
     * Registers the "yaca:changeVoiceRange" command and keybinding.
     * This command is used to change the voice range.
     */
    RegisterCommand(
      "yaca:changeVoiceRange",
      () => {
        this.changeVoiceRange();
      },
      false,
    );
    RegisterKeyMapping("yaca:changeVoiceRange", locale("change_voice_range"), "keyboard", this.sharedConfig.keyBinds.toggleRange);
  }

  registerEvents() {
    /**
     * Handles the "yaca:client:playerEnteredScope" server event.
     *
     * @param {number} target - The ID of the target.
     */
    onNet("yaca:client:playerEnteredScope", (target: number) => {
      const player = this.getPlayerByID(target);
      if (!player) {
        return;
      }

      const frequency = this.radioModule.playersWithShortRange.get(target);
      if (frequency) {
        const channel = this.radioModule.findRadioChannelByFrequency(frequency);
        if (channel) {
          this.setPlayersCommType(player, YacaFilterEnum.RADIO, true, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);

          if (this.sharedConfig.saltyChatBridge) {
            this.saltyChatBridge?.handleRadioReceivingStateChange(true, channel);
          }
        }
      }
    });

    /**
     * Handles the "yaca:client:playerLeftScope" server event.
     *
     * @param {number} target - The ID of the target.
     */
    onNet("yaca:client:playerLeftScope", (target: number) => {
      const player = this.getPlayerByID(target);
      if (!player) {
        return;
      }

      const frequency = this.radioModule.playersWithShortRange.get(target);
      if (frequency) {
        const channel = this.radioModule.findRadioChannelByFrequency(frequency);
        if (channel) {
          this.setPlayersCommType(player, YacaFilterEnum.RADIO, false, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);

          if (this.sharedConfig.saltyChatBridge) {
            const inRadio = this.radioModule.playersInRadioChannel.get(channel);
            if (inRadio) {
              const inRadioArray = [...inRadio].filter((id) => id !== target);
              const state = inRadioArray.length > 0;
              this.saltyChatBridge?.handleRadioReceivingStateChange(state, channel);
            }
          }
        }
      }
    });

    /**
     * Handles the "onClientResourceStart" event.
     *
     * @param {string} resourceName - The name of the resource that has started.
     *
     */
    on("onResourceStop", (resourceName: string) => {
      if (GetCurrentResourceName() !== resourceName) {
        return;
      }

      if (this.websocket.initialized) {
        this.websocket.close();
      }
    });

    /**
     * Handles the "client:yaca:init" server event.
     *
     * @param {DataObject} dataObj - The data object to be initialized.
     */
    onNet("client:yaca:init", async (dataObj: DataObject) => {
      if (this.rangeInterval) {
        clearInterval(this.rangeInterval);
        this.rangeInterval = null;
      }

      if (!this.websocket.initialized) {
        this.websocket.initialized = true;

        this.websocket.on("message", (msg: string) => {
          this.handleResponse(msg);
        });

        this.websocket.on("close", (code: number, reason: string) => {
          console.error("[YACA-Websocket]: client disconnected", code, reason);
          if (this.saltyChatBridge) {
            this.saltyChatBridge.handleDisconnectState();
          }
        });

        this.websocket.on("open", () => {
          if (this.firstConnect) {
            this.initRequest(dataObj);
            this.firstConnect = false;
          } else {
            emitNet("server:yaca:wsReady", this.firstConnect);
          }

          console.log("[YACA-Websocket]: Successfully connected to the voice plugin");
        });

        await this.websocket.start();
      }

      if (this.firstConnect) {
        return;
      }

      this.initRequest(dataObj);
    });

    /**
     * Handles the "client:yaca:disconnect" server event.
     *
     * @param {number} remoteId - The remote ID of the player to be disconnected.
     *
     */
    onNet("client:yaca:disconnect", (remoteId: number) => {
      this.allPlayers.delete(remoteId);
    });

    /**
     * Handles the "client:yaca:addPlayers" server event.
     *
     * @param {DataObject | DataObject[]} dataObjects - The data object or objects to be added.
     */
    onNet("client:yaca:addPlayers", (dataObjects: DataObject | DataObject[]) => {
      if (!Array.isArray(dataObjects)) {
        dataObjects = [dataObjects];
      }

      for (const dataObj of dataObjects) {
        if (!dataObj || typeof dataObj.range === "undefined" || typeof dataObj.clientId === "undefined" || typeof dataObj.playerId === "undefined") {
          continue;
        }

        const currentData = this.getPlayerByID(dataObj.playerId);

        this.allPlayers.set(dataObj.playerId, {
          remoteID: dataObj.playerId,
          clientId: dataObj.clientId,
          forceMuted: dataObj.forceMuted || false,
          range: dataObj.range,
          isTalking: false,
          phoneCallMemberIds: currentData?.phoneCallMemberIds || undefined,
          mutedOnPhone: dataObj.mutedOnPhone || false,
        });
      }
    });

    /**
     * Handles the "client:yaca:muteTarget" server event.
     *
     * @param {number} target - The target to be muted.
     * @param {boolean} muted - The mute status.
     */
    onNet("client:yaca:muteTarget", (target: number, muted: boolean) => {
      const player = this.getPlayerByID(target);
      if (player) {
        player.forceMuted = muted;
      }
    });

    /**
     * Handles the "client:yaca:changeVoiceRange" server event.
     *
     * @param {number} target - The target whose voice range is to be changed.
     * @param {number} range - The new voice range.
     */
    onNet("client:yaca:changeVoiceRange", (target: number, range: number) => {
      if (target === cache.serverId && !this.isPlayerMuted) {
        emit("yaca:external:voiceRangeUpdate", range);
        // SaltyChat bridge
        if (this.sharedConfig.saltyChatBridge) {
          emit("SaltyChat_VoiceRangeChanged", range.toFixed(1), this.rangeIndex, this.sharedConfig.voiceRange.ranges.length);
        }
      }

      const player = this.getPlayerByID(target);
      if (player) {
        player.range = range;
      }
    });

    /**
     * Handles the "client:yaca:notification" server event.
     *
     * @param {string} message - The message to be sent in the notification.
     * @param {YacaNotificationType} type - The type of the notification, e.g. error, inform, success.
     */
    onNet("client:yaca:notification", (message: string, type: YacaNotificationType) => {
      this.notification(message, type);
    });
  }

  /**
   * Get the player by remote ID.
   *
   * @param remoteId The remote ID of the player.
   */
  getPlayerByID(remoteId: number) {
    return this.allPlayers.get(remoteId);
  }

  /**
   * Initializes the plugin.
   *
   * @param {DataObject} dataObj - The data object to initialize the plugin with.
   */
  initRequest(dataObj: DataObject) {
    if (!dataObj || !dataObj.suid || typeof dataObj.chid !== "number" || !dataObj.deChid || !dataObj.ingameName || !dataObj.channelPassword) {
      console.log("[YACA-Websocket]: Error while initializing plugin");
      this.notification(locale("connect_error"), YacaNotificationType.ERROR);
      return;
    }

    this.sendWebsocket({
      base: { request_type: "INIT" },
      server_guid: dataObj.suid,
      ingame_name: dataObj.ingameName,
      ingame_channel: dataObj.chid,
      default_channel: dataObj.deChid,
      ingame_channel_password: dataObj.channelPassword,
      excluded_channels: dataObj.excludeChannels,
      /**
       * Default are 2 meters
       * if the value is set to -1, the player voice range is taken
       * if the value is >= 0, you can set the max muffling range before it gets completely cut off
       */
      muffling_range: this.sharedConfig.mufflingRange ?? 2,
      build_type: this.sharedConfig.buildType ?? 0, // 0 = Release, 1 = Debug,
      unmute_delay: this.sharedConfig.unmuteDelay ?? 400,
      operation_mode: dataObj.useWhisper ? 1 : 0,
    });

    this.useWhisper = dataObj.useWhisper ?? false;
  }

  /**
   * Checks if the plugin is initialized.
   *
   * @returns {boolean} Returns true if the plugin is initialized, false otherwise.
   */
  isPluginInitialized(silent = false): boolean {
    const inited = Boolean(this.getPlayerByID(cache.serverId));

    if (!inited && !silent) {
      this.notification(locale("plugin_not_initialized"), YacaNotificationType.ERROR);
    }

    return inited;
  }

  /**
   * Sends a message to the voice plugin via websocket.
   *
   * @param {object} msg - The message to be sent.
   */
  sendWebsocket(msg: object) {
    if (!this.websocket) {
      console.error("[Voice-Websocket]: No websocket created");
      return;
    }

    if (this.websocket.readyState === 1) {
      this.websocket.send(msg);
    }
  }

  /**
   * Handles messages from the voice plugin.
   *
   * @param {string} payload - The response from the voice plugin.
   */
  handleResponse(payload: string) {
    if (!payload) {
      return;
    }

    let parsedPayload: YacaResponse;

    try {
      parsedPayload = JSON.parse(payload);
    } catch (e) {
      console.error("[YaCA-Websocket]: Error while parsing message: ", e);
      return;
    }

    if (this.saltyChatBridge) {
      this.saltyChatBridge.handleChangePluginState(parsedPayload.code);
    }

    if (parsedPayload.code === "OK") {
      if (parsedPayload.requestType === "JOIN") {
        emitNet("server:yaca:addPlayer", parseInt(parsedPayload.message));

        if (this.rangeInterval) {
          clearInterval(this.rangeInterval);
          this.rangeInterval = null;
        }

        this.rangeInterval = setInterval(this.calcPlayers.bind(this), 250);

        // Set radio settings on reconnect only, else on first opening
        if (this.radioModule.radioInitialized) {
          this.radioModule.initRadioSettings();
        }
        return;
      }

      return;
    }

    if (parsedPayload.code === "TALK_STATE" || parsedPayload.code === "MUTE_STATE") {
      this.handleTalkState(parsedPayload);
      return;
    }

    const message = this.responseCodesToErrorMessages[parsedPayload.code] ?? "Unknown error!";
    if (typeof this.responseCodesToErrorMessages[parsedPayload.code] === "undefined") {
      console.log(`[YaCA-Websocket]: Unknown error code: ${parsedPayload.code}`);
    }
    if (message.length < 1) {
      return;
    }

    this.notification(message, YacaNotificationType.ERROR);
  }

  /**
   * Sets a variable for a player.
   *
   * @param {string} player - The player for whom the variable is to be set.
   * @param {string} variable - The name of the variable.
   * @param {*} value - The value to be set for the variable.
   */
  setPlayerVariable(player: number, variable: string, value: unknown) {
    const currentData = this.getPlayerByID(player);

    if (!currentData) {
      this.allPlayers.set(player, {});
    }

    // @ts-expect-error Object cannot be undefined
    this.getPlayerByID(player)[variable] = value;
  }

  /**
   * Get the current voice range.
   *
   * @returns {number} The current voice range.
   */
  getVoiceRange(): number {
    return this.sharedConfig.voiceRange.ranges[this.rangeIndex];
  }

  /**
   * Changes the voice range to the next range.
   */
  changeVoiceRange() {
    if (!this.canChangeVoiceRange) {
      return;
    }

    if (this.visualVoiceRangeTimeout) {
      clearTimeout(this.visualVoiceRangeTimeout);
      this.visualVoiceRangeTimeout = null;
    }

    if (this.visualVoiceRangeTick) {
      clearInterval(this.visualVoiceRangeTick);
      this.visualVoiceRangeTick = null;
    }

    this.rangeIndex += 1;

    if (this.rangeIndex < 1) {
      this.rangeIndex = this.sharedConfig.voiceRange.ranges.length - 1;
    } else if (this.rangeIndex > this.sharedConfig.voiceRange.ranges.length - 1) {
      this.rangeIndex = 0;
    }

    const voiceRange = this.sharedConfig.voiceRange.ranges[this.rangeIndex] || 1;

    const isMarkerEnable = this.sharedConfig.voiceRange.markerColor?.enabled ?? true;
    if (isMarkerEnable) {
      const red = this.sharedConfig.voiceRange.markerColor?.r ?? 0;
      const green = this.sharedConfig.voiceRange.markerColor?.g ?? 255;
      const blue = this.sharedConfig.voiceRange.markerColor?.b ?? 0;
      const alpha = this.sharedConfig.voiceRange.markerColor?.a ?? 50;
      const duration = this.sharedConfig.voiceRange.markerColor?.duration ?? 1000;

      this.visualVoiceRangeTimeout = setTimeout(() => {
        if (this.visualVoiceRangeTick) {
          clearInterval(this.visualVoiceRangeTick);
          this.visualVoiceRangeTick = null;
        }

        this.visualVoiceRangeTimeout = null;
      }, duration);

      this.visualVoiceRangeTick = setInterval(() => {
        const entity = cache.vehicle || cache.ped,
          pos = GetEntityCoords(entity, false),
          posZ = cache.vehicle ? pos[2] - 0.6 : pos[2] - 0.98;

        DrawMarker(
          1,
          pos[0],
          pos[1],
          posZ,
          0,
          0,
          0,
          0,
          0,
          0,
          voiceRange * 2,
          voiceRange * 2,
          1,
          red,
          green,
          blue,
          alpha,
          false,
          true,
          2,
          true,
          // @ts-expect-error Type error in the native
          null,
          null,
          false,
        );
      });
    }

    emitNet("server:yaca:changeVoiceRange", voiceRange);
  }

  /**
   * Checks if the communication type is valid.
   *
   * @param {string} type - The type of communication to be validated.
   * @returns {boolean} Returns true if the type is valid, false otherwise.
   */
  static isCommTypeValid(type: string): boolean {
    const valid = type in YacaFilterEnum;
    if (!valid) {
      console.error(`[YaCA-Websocket]: Invalid comm type: ${type}`);
    }

    return valid;
  }

  /**
   * Set the communication type for the given players.
   *
   * @param {YacaPlayerData | (YacaPlayerData | undefined)[] | undefined} players - The player or players for whom the communication type is to be set.
   * @param {YacaFilterEnum} type - The type of communication.
   * @param {boolean} state - The state of the communication.
   * @param {number} channel - The channel for the communication. Optional.
   * @param {number} range - The range for the communication. Optional.
   * @param {CommDeviceMode} ownMode - The mode for the player. Optional.
   * @param {CommDeviceMode} otherPlayersMode - The mode for the other players. Optional.
   */
  setPlayersCommType(
    players: YacaPlayerData | (YacaPlayerData | undefined)[] | undefined,
    type: YacaFilterEnum,
    state: boolean,
    channel?: number,
    range?: number,
    ownMode?: CommDeviceMode,
    otherPlayersMode?: CommDeviceMode,
  ) {
    if (!Array.isArray(players)) {
      players = [players];
    }

    const clientIds: YacaClient[] = [];
    if (typeof ownMode !== "undefined") {
      clientIds.push({
        client_id: this.getPlayerByID(cache.serverId)?.clientId,
        mode: ownMode,
      });
    }

    for (const player of players) {
      if (!player) {
        continue;
      }

      clientIds.push({
        client_id: player.clientId,
        mode: otherPlayersMode,
      });
    }

    const protocol: YacaProtocol = {
      on: state,
      comm_type: type,
      members: clientIds,
    };

    if (typeof channel !== "undefined") {
      protocol.channel = channel;
    }
    if (typeof range !== "undefined") {
      protocol.range = range;
    }

    this.sendWebsocket({
      base: { request_type: "INGAME" },
      comm_device: protocol,
    });
  }

  /**
   * Update the volume for a specific communication type.
   *
   * @param {string} type - The type of communication.
   * @param {number} volume - The volume to be set.
   * @param {number} channel - The channel for the communication.
   */
  setCommDeviceVolume(type: YacaFilterEnum, volume: number, channel: number) {
    if (!YaCAClientModule.isCommTypeValid(type)) {
      return;
    }

    const protocol: YacaProtocol = {
      comm_type: type,
      volume: clamp(volume, 0, 1),
    };

    if (typeof channel !== "undefined") {
      protocol.channel = channel;
    }

    this.sendWebsocket({
      base: { request_type: "INGAME" },
      comm_device_settings: protocol,
    });
  }

  /**
   * Update the stereo mode for a specific communication type.
   *
   * @param {YacaFilterEnum} type - The type of communication.
   * @param {YacaStereoMode} mode - The stereo mode to be set.
   * @param {number} channel - The channel for the communication.
   */
  setCommDeviceStereomode(type: YacaFilterEnum, mode: YacaStereoMode, channel: number) {
    if (!YaCAClientModule.isCommTypeValid(type)) {
      return;
    }

    const protocol: YacaProtocol = {
      comm_type: type,
      output_mode: mode,
    };

    if (typeof channel !== "undefined") {
      protocol.channel = channel;
    }

    this.sendWebsocket({
      base: { request_type: "INGAME" },
      comm_device_settings: protocol,
    });
  }

  /**
   * Handles the talk and mute state from teamspeak, displays it in UI and syncs lip to other players.
   *
   * @param {YacaResponse} payload - The response from teamspeak.
   */
  handleTalkState(payload: YacaResponse) {
    // Update state if player is muted or not
    if (payload.code === "MUTE_STATE") {
      this.isPlayerMuted = payload.message === "1";
      emit("yaca:external:voiceRangeUpdate", this.isPlayerMuted ? 0 : this.getVoiceRange());

      // SaltyChat bridge
      if (this.sharedConfig.saltyChatBridge) {
        emit("SaltyChat_MicStateChanged", this.isPlayerMuted);
      }
    }

    const isTalking = !this.isPlayerMuted && payload.message === "1";
    if (this.isTalking !== isTalking) {
      this.isTalking = isTalking;

      const animationData = localLipSyncAnimations[isTalking ? "true" : "false"];

      SetPlayerTalkingOverride(cache.playerId, isTalking);
      PlayFacialAnim(cache.ped, animationData.name, animationData.dict);
      LocalPlayer.state.set("yaca:lipsync", isTalking, true);

      emit("yaca:external:isTalking", isTalking);

      // SaltyChat bridge
      if (this.sharedConfig.saltyChatBridge) {
        emit("SaltyChat_TalkStateChanged", isTalking);
      }
    }
  }

  /**
   * Get the muffle intensity for the nearby player.
   *
   * @param {number} nearbyPlayerPed - The nearby player ped.
   * @param {number} ownCurrentRoom - The current room the client is in.
   * @param {boolean} ownVehicleHasOpening - The opening state ot the vehicle the client is in.
   */
  getMuffleIntensity(nearbyPlayerPed: number, ownCurrentRoom: number, ownVehicleHasOpening: boolean) {
    if (ownCurrentRoom !== GetRoomKeyFromEntity(nearbyPlayerPed) && !HasEntityClearLosToEntity(cache.ped, nearbyPlayerPed, 17)) {
      return this.sharedConfig.mufflingIntensities?.differentRoom ?? 10;
    } else if (this.sharedConfig.vehicleMuffling ?? true) {
      const playerVehicle = GetVehiclePedIsIn(nearbyPlayerPed, false);

      if (cache.vehicle !== playerVehicle) {
        const playerVehicleHasOpening = playerVehicle === 0 || vehicleHasOpening(playerVehicle);

        if (!ownVehicleHasOpening && !playerVehicleHasOpening) {
          return this.sharedConfig.mufflingIntensities?.bothCarsClosed ?? 10;
        } else if (!ownVehicleHasOpening || !playerVehicleHasOpening) {
          return this.sharedConfig.mufflingIntensities?.oneCarClosed ?? 10;
        }
      }
    }

    return 0;
  }

  /**
   * Handles the phone speaker emit.
   *
   * @param playersToPhoneSpeaker - The players to send the phone speaker to.
   * @param playersOnPhoneSpeaker - The players who are on phone speaker.
   */
  handlePhoneSpeakerEmit(playersToPhoneSpeaker: Set<number>, playersOnPhoneSpeaker: Set<number>): void {
    if (
      this.useWhisper &&
      ((this.phoneModule.phoneSpeakerActive && this.phoneModule.inCall) ||
        ((!this.phoneModule.phoneSpeakerActive || !this.phoneModule.inCall) && this.currentlySendingPhoneSpeakerSender.size))
    ) {
      const playersToNotReceivePhoneSpeaker = [...this.currentlySendingPhoneSpeakerSender].filter((playerId) => !playersToPhoneSpeaker.has(playerId)),
        playersNeedsReceivePhoneSpeaker = [...playersToPhoneSpeaker].filter((playerId) => !this.currentlySendingPhoneSpeakerSender.has(playerId));

      this.currentlySendingPhoneSpeakerSender = new Set(playersToPhoneSpeaker);

      if (playersNeedsReceivePhoneSpeaker.length || playersToNotReceivePhoneSpeaker.length) {
        emitNet("server:yaca:phoneSpeakerEmit", playersNeedsReceivePhoneSpeaker, playersToNotReceivePhoneSpeaker);
      }
    }

    this.currentlyPhoneSpeakerApplied.forEach((playerId) => {
      if (!playersOnPhoneSpeaker.has(playerId)) {
        this.currentlyPhoneSpeakerApplied.delete(playerId);
        this.setPlayersCommType(
          this.getPlayerByID(playerId),
          YacaFilterEnum.PHONE_SPEAKER,
          false,
          undefined,
          this.sharedConfig.maxPhoneSpeakerRange,
          CommDeviceMode.RECEIVER,
          CommDeviceMode.SENDER,
        );
      }
    });
  }

  /**
   * Calculate the players in streaming range and send them to the voice plugin.
   */
  calcPlayers() {
    const players = new Map(),
      localPos = GetEntityCoords(cache.ped, false),
      currentRoom = GetRoomKeyFromEntity(cache.ped),
      playersToPhoneSpeaker: Set<number> = new Set(),
      playersOnPhoneSpeaker: Set<number> = new Set(),
      hasVehicleOpening = cache.vehicle === false || vehicleHasOpening(cache.vehicle),
      localData = this.getPlayerByID(cache.serverId);
    if (!localData) {
      return;
    }

    for (const player of GetActivePlayers()) {
      const remoteId = GetPlayerServerId(player);
      if (remoteId === 0 || remoteId === cache.serverId) {
        continue;
      }

      const voiceSetting = this.getPlayerByID(remoteId);
      if (!voiceSetting || !voiceSetting.clientId) {
        continue;
      }

      const playerPed = GetPlayerPed(player);
      if (playerPed <= 0) {
        continue;
      }

      const muffleIntensity = this.getMuffleIntensity(playerPed, currentRoom, hasVehicleOpening);

      const playerPos = GetEntityCoords(playerPed, false),
        playerDirection = GetEntityForwardVector(playerPed),
        // @ts-expect-error Type error in the native
        isUnderwater = IsPedSwimmingUnderWater(playerPed) === 1;

      if (!playersOnPhoneSpeaker.has(remoteId)) {
        players.set(remoteId, {
          client_id: voiceSetting.clientId,
          position: convertNumberArrayToXYZ(playerPos),
          direction: convertNumberArrayToXYZ(playerDirection),
          range: voiceSetting.range,
          is_underwater: isUnderwater,
          muffle_intensity: muffleIntensity,
          is_muted: voiceSetting.forceMuted,
        });
      }

      if (calculateDistanceVec3(localPos, playerPos) > this.sharedConfig.maxPhoneSpeakerRange) {
        continue;
      }

      // Phone speaker handling - user who enabled it.
      if (this.useWhisper && this.phoneModule.phoneSpeakerActive && this.phoneModule.inCall) {
        playersToPhoneSpeaker.add(remoteId);
      }

      // Phone speaker handling.
      if (voiceSetting.phoneCallMemberIds) {
        for (const phoneCallMemberId of voiceSetting.phoneCallMemberIds) {
          const phoneCallMember = this.getPlayerByID(phoneCallMemberId);
          if (!phoneCallMember || phoneCallMember.mutedOnPhone || phoneCallMember.forceMuted) {
            continue;
          }

          players.delete(phoneCallMemberId);
          players.set(phoneCallMemberId, {
            client_id: phoneCallMember.clientId,
            position: convertNumberArrayToXYZ(playerPos),
            direction: convertNumberArrayToXYZ(playerDirection),
            range: this.sharedConfig.maxPhoneSpeakerRange ?? 5,
            is_underwater: isUnderwater,
            muffle_intensity: muffleIntensity,
            is_muted: false,
          });

          playersOnPhoneSpeaker.add(phoneCallMemberId);

          this.setPlayersCommType(
            phoneCallMember,
            YacaFilterEnum.PHONE_SPEAKER,
            true,
            undefined,
            this.sharedConfig.maxPhoneSpeakerRange,
            CommDeviceMode.RECEIVER,
            CommDeviceMode.SENDER,
          );

          this.currentlyPhoneSpeakerApplied.add(phoneCallMemberId);
        }
      }
    }

    this.handlePhoneSpeakerEmit(playersToPhoneSpeaker, playersOnPhoneSpeaker);

    /* Send collected data to the ts-plugin. */
    this.sendWebsocket({
      base: { request_type: "INGAME" },
      player: {
        player_direction: getCamDirection(),
        player_position: convertNumberArrayToXYZ(localPos),
        player_range: localData.range,
        // @ts-expect-error Type error in the native
        player_is_underwater: IsPedSwimmingUnderWater(cache.ped) === 1,
        player_is_muted: localData.forceMuted ?? false,
        players_list: Array.from(players.values()),
      },
    });
  }
}
