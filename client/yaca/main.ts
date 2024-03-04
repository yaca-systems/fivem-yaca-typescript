import {
  cache,
  initLocale,
  locale,
  getLocales,
} from "@overextended/ox_lib/client";
import {
  DataObject,
  type YacaClient,
  YacaLocalPlugin,
  YacaPlayerData,
  type YacaProtocol,
  YacaResponse,
  CommDeviceMode,
  YacaBuildType,
  YacaFilterEnum,
  YacaStereoMode,
  type YacaSharedConfig,
} from "types";
import {
  calculateDistanceVec3,
  convertNumberArrayToXYZ,
  WebSocket,
} from "utils";
import {
  YaCAClientIntercomModule,
  YaCAClientMegaphoneModule,
  YaCAClientPhoneModule,
  YaCAClientRadioModule,
} from "yaca";

initLocale();

const lipsyncAnims: { [key: string]: { name: string; dict: string } } = {
  true: {
    name: "mic_chatter",
    dict: "mp_facial",
  },
  false: {
    name: "mood_normal_1",
    dict: "facials@gen_male@variations@normal",
  },
};

export class YaCAClientModule {
  websocket: WebSocket;
  sharedConfig: YacaSharedConfig;
  allPlayers: Map<number, YacaPlayerData> = new Map();
  playerLocalPlugin: YacaLocalPlugin;
  firstConnect = true;

  radioModule: YaCAClientRadioModule;
  phoneModule: YaCAClientPhoneModule;
  megaphoneModule: YaCAClientMegaphoneModule;
  intercomModule: YaCAClientIntercomModule;

  rangeIndex: number;
  rangeInterval: CitizenTimer | null = null;
  monitorInterval: CitizenTimer | null = null;
  visualVoiceRangeTimeout: CitizenTimer | null = null;
  visualVoiceRangeTick: CitizenTimer | null = null;

  noPluginActivated = 0;
  messageDisplayed = false;
  isTalking = false;
  isPlayerMuted = false;
  useWhisper = false;

  mhinTimeout: CitizenTimer | null = null;
  mhintTick: CitizenTimer | null = null;

  currentlyPhoneSpeakerApplied: Set<number> = new Set();
  currentlySendingPhoneSpeakerSender: Set<number> = new Set();

  /**
   * Displays a hint message.
   *
   * @param {string} head - The heading of the hint.
   * @param {string} msg - The message to be displayed.
   * @param {number} [time=0] - The duration for which the hint should be displayed. If not provided, defaults to 0.
   */
  mhint(head: string, msg: string, time: number = 0) {
    const scaleform = RequestScaleformMovie("MIDSIZED_MESSAGE");

    this.mhinTimeout = setTimeout(
      () => {
        this.mhinTimeout = null;

        if (!HasScaleformMovieLoaded(scaleform)) {
          this.mhint(head, msg, time);
          return;
        }

        BeginScaleformMovieMethod(scaleform, "SHOW_MIDSIZED_MESSAGE");
        BeginTextCommandScaleformString("STRING");
        ScaleformMovieMethodAddParamPlayerNameString(head);
        ScaleformMovieMethodAddParamTextureNameString(msg);
        ScaleformMovieMethodAddParamInt(100);
        ScaleformMovieMethodAddParamBool(true);
        ScaleformMovieMethodAddParamInt(100);
        EndScaleformMovieMethod();

        this.mhintTick = setInterval(() => {
          DrawScaleformMovieFullscreen(scaleform, 255, 255, 255, 255, 0);
        }, 0);

        if (time != 0) {
          setTimeout(() => {
            if (this.mhintTick) clearInterval(this.mhintTick);
            this.mhintTick = null;
          }, time * 1000);
        }
      },
      HasScaleformMovieLoaded(scaleform) ? 0 : 1000,
    );
  }

  stopMhint() {
    if (this.mhinTimeout) clearTimeout(this.mhinTimeout);
    this.mhinTimeout = null;
    if (this.mhintTick) clearInterval(this.mhintTick);
    this.mhintTick = null;
  }

  /**
   * Clamps a value between a minimum and maximum value.
   *
   * @param {number} value - The value to be clamped.
   * @param {number} [min=0] - The minimum value. Defaults to 0 if not provided.
   * @param {number} [max=1] - The maximum value. Defaults to 1 if not provided.
   */
  clamp(value: number, min: number = 0, max: number = 1) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Sends a radar notification.
   *
   * @param {string} message - The message to be sent in the notification.
   */
  radarNotification(message: string) {
    /*
    ~g~ --> green
    ~w~ --> white
    ~r~ --> white
    */

    BeginTextCommandThefeedPost("STRING");
    AddTextComponentSubstringPlayerName(message);
    EndTextCommandThefeedPostTicker(false, false);
  }

  constructor() {
    this.sharedConfig = JSON.parse(
      LoadResourceFile(cache.resource, "config/shared.json"),
    );
    this.websocket = new WebSocket();

    RegisterNuiCallbackType("YACA_OnNuiReady");
    on(
      "__cfx_nui:YACA_OnNuiReady",
      (_: unknown, cb: (data: unknown) => void) => {
        this.websocket.nuiReady = true;
        setTimeout(() => {
          emitNet("server:yaca:nuiReady");
        }, 5000);
        cb({});
      },
    );

    this.rangeIndex = this.sharedConfig.defaultVoiceRangeIndex ?? 0;
    this.playerLocalPlugin = {
      canChangeVoiceRange: true,
      maxVoiceRange: 4,
      lastMegaphoneState: false,
      canUseMegaphone: false,
    };

    this.registerEvents();
    this.registerKeybindings();

    this.intercomModule = new YaCAClientIntercomModule(this);
    this.megaphoneModule = new YaCAClientMegaphoneModule(this);
    this.phoneModule = new YaCAClientPhoneModule(this);
    this.radioModule = new YaCAClientRadioModule(this);

    AddStateBagChangeHandler(
      "yaca:lipsync",
      "",
      (
        bagName: string,
        _: string,
        value: boolean,
        __: number,
        replicated: boolean,
      ) => {
        if (replicated) return;

        const playerId = GetPlayerFromStateBagName(bagName);
        if (playerId == 0) return;

        const playerSource = GetPlayerServerId(playerId);
        if (playerSource == 0) return;

        this.syncLipsPlayer(playerSource, value);
      },
    );

    console.log("[Client] YaCA Client loaded.");
  }

  registerKeybindings() {
    RegisterCommand(
      "yaca:changeVoiceRange",
      () => {
        this.changeVoiceRange();
      },
      false,
    );
    RegisterKeyMapping(
      "yaca:changeVoiceRange",
      "Mikrofon-Reichweite ändern",
      "keyboard",
      "Z",
    );
  }

  registerEvents() {
    on("onClientResourceStop", (resourceName: string) => {
      if (GetCurrentResourceName() !== resourceName) {
        return;
      }

      if (this.websocket.initialized) {
        this.websocket.close();
      }
    });

    onNet("client:yaca:init", async (dataObj: DataObject) => {
      console.log("[YACA-Websocket]: init", JSON.stringify(dataObj));
      if (this.rangeInterval) {
        clearInterval(this.rangeInterval);
        this.rangeInterval = null;
      }

      if (!this.websocket.initialized) {
        this.websocket.initialized = true;

        this.websocket.on("message", (msg: YacaResponse) => {
          this.handleResponse(msg);
        });
        this.websocket.on("error", (reason: string) =>
          console.error("[YACA-Websocket] Error: ", reason),
        );
        this.websocket.on("close", (code: number, reason: string) =>
          console.error("[YACA-Websocket]: client disconnected", code, reason),
        );
        this.websocket.on("open", () => {
          if (this.firstConnect) {
            this.initRequest(dataObj);
            this.firstConnect = false;
          } else {
            emitNet("server:yaca:wsReady", this.firstConnect);
          }

          console.log("[YACA-Websocket]: connected");
        });
        await this.websocket.start();
      }

      this.monitorInterval = setInterval(
        this.monitorConnectstate.bind(this),
        1000,
      );

      if (this.firstConnect) return;

      this.initRequest(dataObj);
    });

    onNet("client:yaca:disconnect", (remoteId: number) => {
      this.allPlayers.delete(remoteId);
    });

    onNet(
      "client:yaca:addPlayers",
      (dataObjects: DataObject | DataObject[]) => {
        if (!Array.isArray(dataObjects)) dataObjects = [dataObjects];

        for (const dataObj of dataObjects) {
          if (
            !dataObj ||
            typeof dataObj.range == "undefined" ||
            typeof dataObj.clientId == "undefined" ||
            typeof dataObj.playerId == "undefined"
          )
            continue;

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
      },
    );

    /**
     * Handles the "client:yaca:muteTarget" server event.
     *
     * @param {number} target - The target to be muted.
     * @param {boolean} muted - The mute status.
     */
    onNet("client:yaca:muteTarget", (target: number, muted: boolean) => {
      const player = this.getPlayerByID(target);
      if (player) player.forceMuted = muted;
    });

    /**
     * Handles the "client:yaca:changeVoiceRange" server event.
     *
     * @param {number} target - The target whose voice range is to be changed.
     * @param {number} range - The new voice range.
     */
    onNet("client:yaca:changeVoiceRange", (target: number, range: number) => {
      if (target == cache.serverId && !this.isPlayerMuted) {
        // this.webview.emit('webview:hud:voiceDistance', range);
      }

      const player = this.getPlayerByID(target);
      if (player) player.range = range;
    });

    /* TODO: Handle stream-in/out

    alt.on("gameEntityCreate", (entity) => {
      if (!entity?.valid || !(entity instanceof alt.Player)) return;

      const entityID = entity.remoteID;

      // Handle megaphone on stream-in
      if (entity.hasStreamSyncedMeta("yaca:megaphoneactive")) {
        YaCAClientModule.setPlayersCommType(
          this.getPlayerByID(entity.remoteID),
          YacaFilterEnum.MEGAPHONE,
          true,
          undefined,
          entity.getStreamSyncedMeta("yaca:megaphoneactive"),
          CommDeviceMode.RECEIVER,
          CommDeviceMode.SENDER
        );
      }

      // Handle phonecallspeaker on stream-in
      if (entity.hasStreamSyncedMeta("yaca:phoneSpeaker")) {
        const value = entity.getStreamSyncedMeta("yaca:phoneSpeaker");

        this.setPlayerVariable(entity, "phoneCallMemberIds", Array.isArray(value) ? value : [value]);
      }

      // Handle shortrange radio on stream-in
      if (this.playersWithShortRange.has(entityID)) {
        const channel = this.findRadioChannelByFrequency(this.playersWithShortRange.get(entityID));
        if (channel) {
          YaCAClientModule.setPlayersCommType(this.getPlayerByID(entityID), YacaFilterEnum.RADIO, true, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);
        }
      }

      this.syncLipsPlayer(entity, !!entity.getStreamSyncedMeta("yaca:lipsync"));
    });

    onNet("gameEntityDestroy", (entity) => {
      if (!entity?.valid || !(entity instanceof alt.Player)) return;

      const entityID = entity.remoteID;

      // Handle phonecallspeaker on stream-out
      this.removePhoneSpeakerFromEntity(entity);

      // Handle megaphone on stream-out
      if (entity?.hasStreamSyncedMeta("yaca:megaphoneactive")) {
        YaCAClientModule.setPlayersCommType(this.getPlayerByID(entityID), YacaFilterEnum.MEGAPHONE, false, undefined, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);
      }

      // Handle shortrange radio on stream-out
      if (this.playersWithShortRange.has(entityID)) {
        YaCAClientModule.setPlayersCommType(this.getPlayerByID(entityID), YacaFilterEnum.RADIO, false, undefined, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);
      }
    });

    */
  }

  getPlayerByID(remoteId: number) {
    return this.allPlayers.get(remoteId);
  }

  initRequest(dataObj: DataObject) {
    if (
      !dataObj ||
      !dataObj.suid ||
      typeof dataObj.chid != "number" ||
      !dataObj.deChid ||
      !dataObj.ingameName ||
      !dataObj.channelPassword
    ) {
      console.log("[YACA-Websocket]: Error while initializing plugin");
      return this.radarNotification(locale("connect_error") ?? "");
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
       * default are 2 meters
       * if the value is set to -1, the player voice range is taken
       * if the value is >= 0, you can set the max muffling range before it gets completely cut off
       */
      muffling_range: this.sharedConfig.mufflingRange ?? 2,
      build_type: YacaBuildType.RELEASE, // 0 = Release, 1 = Debug,
      unmute_delay: this.sharedConfig.unmuteDelay ?? 400,
      operation_mode: dataObj.useWhisper ? 1 : 0,
    });

    this.useWhisper = dataObj.useWhisper ?? false;
  }

  isPluginInitialized() {
    const inited = !!this.getPlayerByID(cache.serverId);

    if (!inited)
      this.radarNotification(locale("plugin_not_initializiaed") ?? "");

    return inited;
  }

  /**
   * Sends a message to the voice plugin via websocket.
   *
   * @param {object} msg - The message to be sent.
   */
  sendWebsocket(msg: object) {
    if (!this.websocket)
      return console.error("[Voice-Websocket]: No websocket created");

    if (this.websocket.readyState == 1) this.websocket.send(msg);
  }

  /**
   * Handles messages from the voice plugin.
   *
   * @param {string} payload - The response from the voice plugin.
   */
  handleResponse(payload: YacaResponse) {
    if (!payload) return;

    if (payload.code === "OK") {
      if (payload.requestType === "JOIN") {
        emitNet("server:yaca:addPlayer", parseInt(payload.message));

        if (this.rangeInterval) {
          clearInterval(this.rangeInterval);
          this.rangeInterval = null;
        }

        this.rangeInterval = setInterval(this.calcPlayers.bind(this), 250);

        // Set radio settings on reconnect only, else on first opening
        if (this.radioModule.radioInitialized)
          this.radioModule.initRadioSettings();
        return;
      }

      return;
    }

    if (payload.code === "TALK_STATE" || payload.code === "MUTE_STATE") {
      this.handleTalkState(payload);
      return;
    }

    const locale = getLocales()[payload.code];
    const message = locale ?? "Unknown error!";
    if (typeof locale === "undefined")
      console.log(`[YaCA-Websocket]: Unknown error code: ${payload.code}`);
    if (message.length < 1) return;

    BeginTextCommandThefeedPost("STRING");
    AddTextComponentSubstringPlayerName(`Voice: ${message}`);
    ThefeedSetNextPostBackgroundColor(6);
    EndTextCommandThefeedPostTicker(false, false);
  }

  /**
   * Synchronizes the lip movement of a player based on whether they are talking or not.
   *
   * @param {number} player - The player whose lips are to be synchronized.
   * @param {boolean} isTalking - Indicates whether the player is talking.
   */
  syncLipsPlayer(player: number, isTalking: boolean) {
    const animationData = lipsyncAnims[isTalking ? "true" : "false"];

    const ped = GetPlayerPed(GetPlayerFromServerId(player));

    PlayFacialAnim(ped, animationData.name, animationData.dict);

    this.setPlayerVariable(player, "isTalking", isTalking);
  }

  /**
   * Convert camera rotation to direction vector.
   */
  getCamDirection() {
    const rotVector = GetGameplayCamRot(0);
    const num = rotVector[2] * 0.0174532924;
    const num2 = rotVector[0] * 0.0174532924;
    const num3 = Math.abs(Math.cos(num2));

    return {
      x: -Math.sin(num) * num3,
      y: Math.cos(num) * num3,
      z: GetEntityForwardVector(cache.ped)[2],
    };
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

    if (!currentData) this.allPlayers.set(player, {});

    // @ts-expect-error TODO
    this.getPlayerByID(player)[variable] = value;
  }

  /**
   * Changes the voice range.
   */
  changeVoiceRange() {
    if (!this.playerLocalPlugin.canChangeVoiceRange) return false;

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
      this.rangeIndex = this.sharedConfig.voiceRanges.length - 1;
    } else if (this.rangeIndex > this.sharedConfig.voiceRanges.length - 1) {
      this.rangeIndex = 0;
    }

    const voiceRange = this.sharedConfig.voiceRanges[this.rangeIndex] || 1;

    this.visualVoiceRangeTimeout = setTimeout(() => {
      if (this.visualVoiceRangeTick) {
        clearInterval(this.visualVoiceRangeTick);
        this.visualVoiceRangeTick = null;
      }

      this.visualVoiceRangeTimeout = null;
    }, 1000);

    this.visualVoiceRangeTick = setInterval(() => {
      const pos = GetEntityCoords(cache.ped, false);
      DrawMarker(
        1,
        pos[0],
        pos[1],
        pos[2] - 0.98,
        0,
        0,
        0,
        0,
        0,
        0,
        voiceRange * 2 - 1,
        voiceRange * 2 - 1,
        1,
        0,
        255,
        0,
        50,
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

    emitNet("server:yaca:changeVoiceRange", voiceRange);

    return true;
  }

  /**
   * Checks if the communication type is valid.
   *
   * @param {string} type - The type of communication to be validated.
   * @returns {boolean} Returns true if the type is valid, false otherwise.
   */
  isCommTypeValid(type: string): boolean {
    const valid = type in YacaFilterEnum;
    if (!valid) console.error(`[YaCA-Websocket]: Invalid commtype: ${type}`);

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
   * @param {CommDeviceMode} ownMode
   * @param {CommDeviceMode} otherPlayersMode
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
    if (!Array.isArray(players)) players = [players];

    const cids: YacaClient[] = [];
    if (typeof ownMode != "undefined") {
      cids.push({
        client_id: this.getPlayerByID(cache.serverId)?.clientId,
        mode: ownMode,
      });
    }

    for (const player of players) {
      if (!player) continue;

      cids.push({
        client_id: player.clientId,
        mode: otherPlayersMode,
      });
    }

    const protocol: YacaProtocol = {
      on: state,
      comm_type: type,
      members: cids,
    };

    if (typeof channel !== "undefined") protocol.channel = channel;
    if (typeof range !== "undefined") protocol.range = range;

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
    if (!this.isCommTypeValid(type)) return;

    const protocol: YacaProtocol = {
      comm_type: type,
      volume: this.clamp(volume, 0, 1),
    };

    if (typeof channel !== "undefined") protocol.channel = channel;

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
  setCommDeviceStereomode(
    type: YacaFilterEnum,
    mode: YacaStereoMode,
    channel: number,
  ) {
    if (!this.isCommTypeValid(type)) return;

    const protocol: YacaProtocol = {
      comm_type: type,
      output_mode: mode,
    };

    if (typeof channel !== "undefined") protocol.channel = channel;

    this.sendWebsocket({
      base: { request_type: "INGAME" },
      comm_device_settings: protocol,
    });
  }

  /* ======================== BASIC SYSTEM ======================== */

  /**
   * Monitoring if player is connected to teamspeak.
   */
  monitorConnectstate() {
    if (this.websocket?.readyState == 0 || this.websocket?.readyState == 1) {
      if (this.messageDisplayed && this.websocket.readyState == 1) {
        this.stopMhint();
        this.messageDisplayed = false;
        this.noPluginActivated = 0;
      }
      return;
    }

    this.noPluginActivated++;

    if (!this.messageDisplayed) {
      this.mhint("Voiceplugin", locale("plugin_not_activated") ?? "");
      this.messageDisplayed = true;
    }

    if (this.noPluginActivated >= 120) emitNet("server:yaca:noVoicePlugin");
  }

  /**
   * Handles the talk and mute state from teamspeak, displays it in UI and syncs lip to other players.
   *
   * @param {YacaResponse} payload - The response from teamspeak.
   */
  handleTalkState(payload: YacaResponse) {
    // Update state if player is muted or not
    if (payload.code === "MUTE_STATE") {
      this.isPlayerMuted = !!parseInt(payload.message);
      // TODO: this.webview.emit('webview:hud:voiceDistance', this.isPlayerMuted ? 0 : voiceRangesEnum[this.uirange]);
    }

    const isTalking = !this.isPlayerMuted && !!parseInt(payload.message);
    if (this.isTalking != isTalking) {
      this.isTalking = isTalking;

      // TODO: this.webview.emit('webview:hud:isTalking', isTalking);

      // TODO: Deprecated if alt:V syncs the playFacialAnim native
      emitNet("server:yaca:lipsync", isTalking);
    }
  }

  /**
   * Calculate the players in streamingrange and send them to the voiceplugin.
   */
  calcPlayers() {
    const players = new Map();
    const localPos = GetEntityCoords(cache.ped, false);
    const currentRoom = GetRoomKeyFromEntity(cache.ped);
    const playersToPhoneSpeaker: Set<number> = new Set();
    const playersOnPhoneSpeaker: Set<number> = new Set();

    const localData = this.getPlayerByID(cache.serverId);
    if (!localData) return;

    for (const player of GetActivePlayers()) {
      const remoteId = GetPlayerServerId(player);
      if (remoteId == 0 || remoteId == cache.serverId) continue;

      const voiceSetting = this.getPlayerByID(remoteId);
      if (!voiceSetting?.clientId) continue;

      const playerPed = GetPlayerPed(player);

      let muffleIntensity = 0;
      if (
        currentRoom != GetRoomKeyFromEntity(player) &&
        !HasEntityClearLosToEntity(cache.ped, playerPed, 17)
      ) {
        muffleIntensity = 10; // 10 is the maximum intensity
      }

      const playerPos = GetEntityCoords(playerPed, false);
      const playerDirection = GetEntityForwardVector(playerPed);
      const isUnderwater = IsPedSwimmingUnderWater(playerPed);

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

      // Phone speaker handling - user who enabled it.
      if (
        this.useWhisper &&
        this.phoneModule.phoneSpeakerActive &&
        this.phoneModule.inCall &&
        calculateDistanceVec3(localPos, playerPos) <=
          this.sharedConfig.maxPhoneSpeakerRange
      ) {
        playersToPhoneSpeaker.add(player.remoteID);
      }

      // Phone speaker handling.
      if (
        voiceSetting.phoneCallMemberIds &&
        calculateDistanceVec3(localPos, playerPos) <=
          this.sharedConfig.maxPhoneSpeakerRange
      ) {
        for (const phoneCallMemberId of voiceSetting.phoneCallMemberIds) {
          const phoneCallMember = this.getPlayerByID(phoneCallMemberId);
          if (
            !phoneCallMember ||
            phoneCallMember.mutedOnPhone ||
            phoneCallMember.forceMuted
          )
            continue;

          players.delete(phoneCallMemberId);
          players.set(phoneCallMemberId, {
            client_id: phoneCallMember.clientId,
            position: convertNumberArrayToXYZ(playerPos),
            direction: convertNumberArrayToXYZ(playerDirection),
            range: this.sharedConfig.maxPhoneSpeakerRange,
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

    if (
      this.useWhisper &&
      ((this.phoneModule.phoneSpeakerActive && this.phoneModule.inCall) ||
        ((!this.phoneModule.phoneSpeakerActive || !this.phoneModule.inCall) &&
          this.currentlySendingPhoneSpeakerSender.size))
    ) {
      const playersToNotReceivePhoneSpeaker = [
        ...this.currentlySendingPhoneSpeakerSender,
      ].filter((playerId) => !playersToPhoneSpeaker.has(playerId));
      const playersNeedsReceivePhoneSpeaker = [...playersToPhoneSpeaker].filter(
        (playerId) => !this.currentlySendingPhoneSpeakerSender.has(playerId),
      );

      this.currentlySendingPhoneSpeakerSender = new Set(playersToPhoneSpeaker);

      if (
        playersToNotReceivePhoneSpeaker.length ||
        playersNeedsReceivePhoneSpeaker.length
      ) {
        emitNet(
          "server:yaca:phoneSpeakerEmit",
          playersNeedsReceivePhoneSpeaker,
          playersToNotReceivePhoneSpeaker,
        );
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

    /** Send collected data to ts-plugin. */
    this.sendWebsocket({
      base: { request_type: "INGAME" },
      player: {
        player_direction: this.getCamDirection(),
        player_position: convertNumberArrayToXYZ(localPos),
        player_range: localData.range,
        player_is_underwater: IsPedSwimmingUnderWater(cache.ped),
        player_is_muted: localData.forceMuted,
        players_list: Array.from(players.values()),
      },
    });
  }
}
