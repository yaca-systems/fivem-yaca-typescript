import {
  cache,
  initLocale,
  locale,
  requestAnimDict,
  getLocales,
} from "@overextended/ox_lib/client";
import {
  DataObject,
  type YacaClient,
  YacaLocalPlugin,
  YacaPlayerData,
  type YacaProtocol,
  type YacaRadioSettings,
  YacaResponse,
  CommDeviceMode,
  YacaBuildType,
  YacaFilterEnum,
  YacaStereoMode,
  type YacaSharedConfig,
} from "types";
import { calculateDistanceVec3, convertNumberArrayToXYZ } from "utils";
import { WebSocket } from "websocket";

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
  static instance: YaCAClientModule;
  static allPlayers: Map<number, YacaPlayerData> = new Map();
  sharedConfig: YacaSharedConfig;
  playerLocalPlugin: YacaLocalPlugin;

  rangeInterval: CitizenTimer | null = null;
  monitorInterval: CitizenTimer | null = null;
  websocket: WebSocket;
  noPluginActivated = 0;
  messageDisplayed = false;
  visualVoiceRangeTimeout: CitizenTimer | null = null;
  visualVoiceRangeTick: CitizenTimer | null = null;
  uirange: number = 2;
  lastuiRange = 2;
  isTalking = false;
  firstConnect = true;
  isPlayerMuted = false;

  radioFrequenceSetted = false;
  radioToggle = false;
  radioEnabled = false;
  radioTalking = false;
  radioChannelSettings: { [key: number]: YacaRadioSettings } = {};
  radioInited = false;
  activeRadioChannel = 1;
  playersWithShortRange = new Map();
  playersInRadioChannel: Map<number, Set<number>> = new Map();

  phoneSpeakerActive = false;
  currentlyPhoneSpeakerApplied: Set<number> = new Set();

  useWhisper = false;

  mhinTimeout: CitizenTimer | null = null;
  mhintTick: CitizenTimer | null = null;

  inCall: boolean = false;

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
      LoadResourceFile(cache.resource, `configs/shared.json`),
    );
    this.websocket = new WebSocket();

    this.playerLocalPlugin = {
      canChangeVoiceRange: true,
      maxVoiceRange: 4,
      lastMegaphoneState: false,
      canUseMegaphone: false,
    };

    this.registerEvents();
    this.registerKeybindings();

    AddStateBagChangeHandler(
      "yaca:megaphoneactive",
      "",
      (
        bagName: string,
        _: string,
        value: number | undefined,
        __: number,
        replicated: boolean,
      ) => {
        if (replicated) return;

        const playerId = GetPlayerFromStateBagName(bagName);
        if (playerId == 0) return;

        const playerSource = GetPlayerServerId(playerId);
        if (playerSource == 0) return;

        const isOwnPlayer = playerSource === cache.serverId;
        YaCAClientModule.setPlayersCommType(
          isOwnPlayer ? [] : this.getPlayerByID(playerSource),
          YacaFilterEnum.MEGAPHONE,
          typeof value !== "undefined",
          undefined,
          value,
          isOwnPlayer ? CommDeviceMode.SENDER : CommDeviceMode.RECEIVER,
          isOwnPlayer ? CommDeviceMode.RECEIVER : CommDeviceMode.SENDER,
        );
      },
    );

    AddStateBagChangeHandler(
      "yaca:phoneSpeaker",
      "",
      (
        bagName: string,
        _: string,
        value: object,
        __: number,
        replicated: boolean,
      ) => {
        if (replicated) return;

        const playerId = GetPlayerFromStateBagName(bagName);
        if (playerId == 0) return;

        const playerSource = GetPlayerServerId(playerId);
        if (playerSource == 0) return;

        if (playerSource == cache.serverId) this.phoneSpeakerActive = !!value;

        this.removePhoneSpeakerFromEntity(playerSource);
        if (typeof value != "undefined") {
          this.setPlayerVariable(
            playerSource,
            "phoneCallMemberIds",
            Array.isArray(value) ? value : [value],
          );
        }
      },
    );

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

  /***
   * Gets the singleton of YaCAClientModule
   *
   * @returns {YaCAClientModule}
   */
  static getInstance(): YaCAClientModule {
    if (!this.instance) {
      this.instance = new YaCAClientModule();
    }

    return this.instance;
  }

  registerKeybindings() {
    RegisterCommand(
      "yaca:changeVoiceRangeAdd",
      () => {
        this.changeVoiceRange(1);
      },
      false,
    );
    // RegisterKeyMapping("yaca:changeVoiceRangeAdd", "Mikrofon-Reichweite +", "keyboard", "F9");

    RegisterCommand(
      "yaca:changeVoiceRangeRemove",
      () => {
        this.changeVoiceRange(-1);
      },
      false,
    );
    // RegisterKeyMapping("yaca:changeVoiceRangeRemove", "Mikrofon-Reichweite -", "keyboard", "F9");

    RegisterCommand(
      "yaca:radioUI",
      () => {
        this.openRadio();
      },
      false,
    );
    // RegisterKeyMapping('yaca:radioUI', 'Radio UI', 'keyboard', 'F10')

    RegisterCommand(
      "+yaca:radioTalking",
      () => {
        this.radioTalkingStart(true);
      },
      false,
    );
    RegisterCommand(
      "-yaca:radioTalking",
      () => {
        this.radioTalkingStart(false);
      },
      false,
    );
    RegisterKeyMapping("yaca:radioTalking", "Funk Sprechen", "keyboard", "N");

    RegisterCommand(
      "+yaca:megaphone",
      () => {
        this.useMegaphone(true);
      },
      false,
    );
    RegisterCommand(
      "-yaca:megaphone",
      () => {
        this.useMegaphone(false);
      },
      false,
    );
    RegisterKeyMapping("yaca:megaphone", "Megaphone", "keyboard", "M");
  }

  registerEvents() {
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
      YaCAClientModule.allPlayers.delete(remoteId);
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

          YaCAClientModule.allPlayers.set(dataObj.playerId, {
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

    /**
     * Handles the "client:yaca:setMaxVoiceRange" server event.
     *
     * @param {number} maxRange - The maximum voice range to be set.
     */
    onNet("client:yaca:setMaxVoiceRange", (maxRange: number) => {
      this.playerLocalPlugin.maxVoiceRange = maxRange;

      if (maxRange == 15) {
        this.uirange = 4;
        this.lastuiRange = 4;
      }
    });

    /* =========== RADIO SYSTEM =========== */
    /* this.webview.on('client:yaca:enableRadio', (state) => {
      if (!this.isPluginInitialized()) return;

      if (this.radioEnabled != state) {
        this.radioEnabled = state;
        alt.emitServerRaw("server:yaca:enableRadio", state);

        if (!state) {
          for (let i = 1; i <= settings.maxRadioChannels; i++) {
            this.disableRadioFromPlayerInChannel(i);
          }
        }
      }

      this.webview.emit('webview:hud:radioState', state);

      if (state && !this.radioInited) {
        this.radioInited = true;
        this.initRadioSettings();
        this.updateRadioInWebview(this.activeRadioChannel);
      }
    });

    this.webview.on('client:yaca:changeRadioFrequency', (frequency) => {
      if (!this.isPluginInitialized()) return;

      alt.emitServerRaw("server:yaca:changeRadioFrequency", this.activeRadioChannel, frequency);
    }); */

    onNet("client:yaca:setRadioFreq", (channel: number, frequency: string) => {
      this.setRadioFrequency(channel, frequency);
    });

    onNet(
      "client:yaca:radioTalking",
      (
        target: number,
        frequency: string,
        state: boolean,
        infos: { shortRange: boolean }[],
        self = false,
      ) => {
        if (self) {
          this.radioTalkingStateToPluginWithWhisper(state, target);
          return;
        }

        const channel = this.findRadioChannelByFrequency(frequency);
        if (!channel) return;

        const player = this.getPlayerByID(target);
        if (!player) return;

        const info = infos[cache.serverId];

        if (
          !info?.shortRange /* TODO: || (info?.shortRange && alt.Player.getByRemoteID(target)?.isSpawned) */
        ) {
          YaCAClientModule.setPlayersCommType(
            player,
            YacaFilterEnum.RADIO,
            state,
            channel,
            undefined,
            CommDeviceMode.RECEIVER,
            CommDeviceMode.SENDER,
          );
        }

        state
          ? this.playersInRadioChannel.get(channel)?.add(target)
          : this.playersInRadioChannel.get(channel)?.delete(target);

        if (info?.shortRange || !state) {
          if (state) {
            this.playersWithShortRange.set(target, frequency);
          } else {
            this.playersWithShortRange.delete(target);
          }
        }
      },
    );

    /* this.webview.on('client:yaca:muteRadioChannel', () => {
      if (!this.isPluginInitialized() || !this.radioEnabled) return;

      const channel = this.activeRadioChannel;
      if (this.radioChannelSettings[channel].frequency == 0) return;
      alt.emitServerRaw("server:yaca:muteRadioChannel", channel)
    }); */

    onNet(
      "client:yaca:setRadioMuteState",
      (channel: number, state: boolean) => {
        this.radioChannelSettings[channel].muted = state;
        this.updateRadioInWebview(channel);
        this.disableRadioFromPlayerInChannel(channel);
      },
    );

    onNet(
      "client:yaca:leaveRadioChannel",
      (client_ids: number | number[], frequency: string) => {
        if (!Array.isArray(client_ids)) client_ids = [client_ids];

        const channel = this.findRadioChannelByFrequency(frequency);
        if (!channel) return;

        const playerData = this.getPlayerByID(cache.serverId);
        if (!playerData || !playerData.clientId) return;

        if (client_ids.includes(playerData.clientId))
          this.setRadioFrequency(channel, "0");

        this.sendWebsocket({
          base: { request_type: "INGAME" },
          comm_device_left: {
            comm_type: YacaFilterEnum.RADIO,
            client_ids: client_ids,
            channel: channel,
          },
        });
      },
    );

    /*this.webview.on('client:yaca:changeActiveRadioChannel', (channel) => {
      if (!this.isPluginInitialized() || !this.radioEnabled) return;

      alt.emitServerRaw('server:yaca:changeActiveRadioChannel', channel);
      this.activeRadioChannel = channel;
      this.updateRadioInWebview(channel);
    });

    this.webview.on('client:yaca:changeRadioChannelVolume', (higher) => {
      if (!this.isPluginInitialized() || !this.radioEnabled || this.radioChannelSettings[this.activeRadioChannel].frequency == 0) return;

      const channel = this.activeRadioChannel;
      const oldVolume = this.radioChannelSettings[channel].volume;
      this.radioChannelSettings[channel].volume = this.clamp(
        oldVolume + (higher ? 0.17 : -0.17),
        0,
        1
      )

      // Prevent event emit spams, if nothing changed
      if (oldVolume == this.radioChannelSettings[channel].volume) return

      if (this.radioChannelSettings[channel].volume == 0 || (oldVolume == 0 && this.radioChannelSettings[channel].volume > 0)) {
        alt.emitServerRaw("server:yaca:muteRadioChannel", channel)
      }

      // Prevent duplicate update, cuz mute has its own update
      if (this.radioChannelSettings[channel].volume > 0) this.updateRadioInWebview(channel);

      // Send update to voiceplugin
      this.setCommDeviceVolume(YacaFilterEnum.RADIO, this.radioChannelSettings[channel].volume, channel);
    });

    this.webview.on("client:yaca:changeRadioChannelStereo", () => {
      if (!this.isPluginInitialized() || !this.radioEnabled) return;

      const channel = this.activeRadioChannel;

      switch (this.radioChannelSettings[channel].stereo) {
        case YacaStereoMode.STEREO:
          this.radioChannelSettings[channel].stereo = YacaStereoMode.MONO_LEFT;
          this.radarNotification(`Kanal ${channel} ist nun auf der linken Seite hörbar.`);
          break;
        case YacaStereoMode.MONO_LEFT:
          this.radioChannelSettings[channel].stereo = YacaStereoMode.MONO_RIGHT;
          this.radarNotification(`Kanal ${channel} ist nun auf der rechten Seite hörbar.`);
          break;
        case YacaStereoMode.MONO_RIGHT:
          this.radioChannelSettings[channel].stereo = YacaStereoMode.STEREO;
          this.radarNotification(`Kanal ${channel} ist nun auf beiden Seiten hörbar.`);
      };

      // Send update to voiceplugin
      this.setCommDeviceStereomode(YacaFilterEnum.RADIO, this.radioChannelSettings[channel].stereo, channel);
    });

    //TODO: Implement, will be used if player activates radio speaker so everyone around him can hear it
    this.webview.on("client:yaca:changeRadioSpeaker", () => {

    }) */

    /* =========== INTERCOM SYSTEM =========== */
    /**
     * Handles the "client:yaca:addRemovePlayerIntercomFilter" server event.
     *
     * @param {Number[] | Number} playerIDs - The IDs of the players to be added or removed from the intercom filter.
     * @param {boolean} state - The state indicating whether to add or remove the players.
     */
    onNet(
      "client:yaca:addRemovePlayerIntercomFilter",
      (playerIDs: number | number[], state: boolean) => {
        if (!Array.isArray(playerIDs)) playerIDs = [playerIDs];

        const playersToAddRemove: Set<YacaPlayerData> = new Set();
        for (const playerID of playerIDs) {
          const player = this.getPlayerByID(playerID);
          if (!player) continue;
          playersToAddRemove.add(player);
        }

        if (playersToAddRemove.size < 1) return;
        YaCAClientModule.setPlayersCommType(
          Array.from(playersToAddRemove),
          YacaFilterEnum.INTERCOM,
          state,
          undefined,
          undefined,
          CommDeviceMode.TRANSCEIVER,
          CommDeviceMode.TRANSCEIVER,
        );
      },
    );

    /* =========== PHONE SYSTEM =========== */
    /**
     * Handles the "client:yaca:phone" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet("client:yaca:phone", (targetID: number, state: boolean) => {
      const target = this.getPlayerByID(targetID);
      if (!target) return;

      this.inCall = state;

      YaCAClientModule.setPlayersCommType(
        target,
        YacaFilterEnum.PHONE,
        state,
        undefined,
        undefined,
        CommDeviceMode.TRANSCEIVER,
        CommDeviceMode.TRANSCEIVER,
      );
    });

    /**
     * Handles the "client:yaca:phoneOld" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet("client:yaca:phoneOld", (targetID: number, state: boolean) => {
      const target = this.getPlayerByID(targetID);
      if (!target) return;

      this.inCall = state;

      YaCAClientModule.setPlayersCommType(
        target,
        YacaFilterEnum.PHONE_HISTORICAL,
        state,
        undefined,
        undefined,
        CommDeviceMode.TRANSCEIVER,
        CommDeviceMode.TRANSCEIVER,
      );
    });

    onNet(
      "client:yaca:phoneMute",
      (targetID: number, state: boolean, onCallstop: boolean = false) => {
        const target = this.getPlayerByID(targetID);
        if (!target) return;

        target.mutedOnPhone = state;

        if (onCallstop) return;

        if (this.useWhisper && target.remoteID == cache.serverId) {
          YaCAClientModule.setPlayersCommType(
            [],
            YacaFilterEnum.PHONE,
            !state,
            undefined,
            undefined,
            CommDeviceMode.SENDER,
          );
        } else if (!this.useWhisper) {
          if (state) {
            YaCAClientModule.setPlayersCommType(
              target,
              YacaFilterEnum.PHONE,
              false,
              undefined,
              undefined,
              CommDeviceMode.TRANSCEIVER,
              CommDeviceMode.TRANSCEIVER,
            );
          } else {
            YaCAClientModule.setPlayersCommType(
              target,
              YacaFilterEnum.PHONE,
              true,
              undefined,
              undefined,
              CommDeviceMode.TRANSCEIVER,
              CommDeviceMode.TRANSCEIVER,
            );
          }
        }
      },
    );

    onNet(
      "client:yaca:playersToPhoneSpeakerEmit",
      (playerIDs: number | number[], state: boolean) => {
        if (!Array.isArray(playerIDs)) playerIDs = [playerIDs];

        const applyRemovePhoneSpeaker: Set<YacaPlayerData> = new Set();
        for (const playerID of playerIDs) {
          const player = this.getPlayerByID(playerID);
          if (!player) continue;

          applyRemovePhoneSpeaker.add(player);
        }

        if (applyRemovePhoneSpeaker.size < 1) return;

        if (state) {
          YaCAClientModule.setPlayersCommType(
            Array.from(applyRemovePhoneSpeaker),
            YacaFilterEnum.PHONE_SPEAKER,
            true,
            undefined,
            undefined,
            CommDeviceMode.SENDER,
            CommDeviceMode.RECEIVER,
          );
        } else {
          YaCAClientModule.setPlayersCommType(
            Array.from(applyRemovePhoneSpeaker),
            YacaFilterEnum.PHONE_SPEAKER,
            false,
            undefined,
            undefined,
            CommDeviceMode.SENDER,
            CommDeviceMode.RECEIVER,
          );
        }
      },
    );

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
    return YaCAClientModule.allPlayers.get(remoteId);
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
        if (this.radioInited) this.initRadioSettings();
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

    if (!currentData) YaCAClientModule.allPlayers.set(player, {});

    // @ts-expect-error TODO
    this.getPlayerByID(player)[variable] = value;
  }

  /**
   * Changes the voice range.
   *
   * @param {number} toggle - The new voice range.
   */
  changeVoiceRange(toggle: number) {
    if (!this.playerLocalPlugin.canChangeVoiceRange) return false;

    if (this.visualVoiceRangeTimeout) {
      clearTimeout(this.visualVoiceRangeTimeout);
      this.visualVoiceRangeTimeout = null;
    }

    if (this.visualVoiceRangeTick) {
      clearInterval(this.visualVoiceRangeTick);
      this.visualVoiceRangeTick = null;
    }

    this.uirange += toggle;

    if (this.uirange < 1) {
      this.uirange = 1;
    } else if (this.uirange == 5 && this.playerLocalPlugin.maxVoiceRange < 5) {
      this.uirange = 4;
    } else if (this.uirange == 6 && this.playerLocalPlugin.maxVoiceRange < 6) {
      this.uirange = 5;
    } else if (this.uirange == 7 && this.playerLocalPlugin.maxVoiceRange < 7) {
      this.uirange = 6;
    } else if (this.uirange == 8 && this.playerLocalPlugin.maxVoiceRange < 8) {
      this.uirange = 7;
    } else if (this.uirange > 8) {
      this.uirange = 8;
    }

    if (this.lastuiRange == this.uirange) return false;
    this.lastuiRange = this.uirange;

    const voiceRange = this.sharedConfig.voiceRanges[this.uirange] || 1;

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
  static setPlayersCommType(
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
        client_id: YaCAClientModule.getInstance().getPlayerByID(cache.serverId)
          ?.clientId,
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

    YaCAClientModule.getInstance().sendWebsocket({
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
        this.phoneSpeakerActive &&
        this.inCall &&
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

          YaCAClientModule.setPlayersCommType(
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
      ((this.phoneSpeakerActive && this.inCall) ||
        ((!this.phoneSpeakerActive || !this.inCall) &&
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
        YaCAClientModule.setPlayersCommType(
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

  /* ======================== RADIO SYSTEM ======================== */

  // TODO: Implement the radio system
  openRadio() {
    if (!this.radioToggle /* && !alt.isCursorVisible() */) {
      this.radioToggle = true;
      /* alt.showCursor(true);
      this.webview.emit('webview:radio:openState', true);
      NKeyhandler.disableAllKeybinds("radioUI", true, ["yaca:radioUI", "yaca:radioTalking"], ["yaca:radioTalking"]) */
    } else if (this.radioToggle) {
      this.closeRadio();
    }
  }

  /**
   * Cleanup different things, if player closes his radio.
   */
  closeRadio() {
    this.radioToggle = false;

    /* alt.showCursor(false);
    this.webview.emit('webview:radio:openState', false);
    NKeyhandler.disableAllKeybinds("radioUI", false, ["yaca:radioUI", "yaca:radioTalking"], ["yaca:radioTalking"]); */
  }

  /**
   * Set volume & stereo mode for all radio channels on first start and reconnect.
   */
  initRadioSettings() {
    for (let i = 1; i <= this.sharedConfig.maxRadioChannels; i++) {
      if (!this.radioChannelSettings[i])
        this.radioChannelSettings[i] = Object.assign(
          {},
          this.sharedConfig.defaultRadioChannelSettings,
        );
      if (!this.playersInRadioChannel.has(i))
        this.playersInRadioChannel.set(i, new Set());

      const volume = this.radioChannelSettings[i].volume;
      const stereo = this.radioChannelSettings[i].stereo;

      this.setCommDeviceStereomode(YacaFilterEnum.RADIO, stereo, i);
      this.setCommDeviceVolume(YacaFilterEnum.RADIO, volume, i);
    }
  }

  /**
   * Sends an event to the plugin when a player starts or stops talking on the radio.
   *
   * @param {boolean} state - The state of the player talking on the radio.
   */
  radioTalkingStateToPlugin(state: boolean) {
    YaCAClientModule.setPlayersCommType(
      cache.serverId,
      YacaFilterEnum.RADIO,
      state,
      this.activeRadioChannel,
      undefined,
      CommDeviceMode.SENDER,
      CommDeviceMode.RECEIVER,
    );
  }

  radioTalkingStateToPluginWithWhisper(
    state: boolean,
    targets: number | number[],
  ) {
    if (!Array.isArray(targets)) targets = [targets];

    const comDeviceTargets = [];
    for (const target of targets) {
      const player = this.getPlayerByID(target);
      if (!player) continue;

      comDeviceTargets.push(player);
    }

    YaCAClientModule.setPlayersCommType(
      comDeviceTargets,
      YacaFilterEnum.RADIO,
      state,
      this.activeRadioChannel,
      undefined,
      CommDeviceMode.SENDER,
      CommDeviceMode.RECEIVER,
    );
  }

  /**
   * Updates the UI when a player changes the radio channel.
   *
   * @param {number} channel - The new radio channel.
   */
  updateRadioInWebview(channel: number) {
    if (channel != this.activeRadioChannel) return;

    // this.webview.emit("webview:radio:setChannelData", this.radioChannelSettings[channel]);
    // this.webview.emit('webview:hud:radioChannel', channel, this.radioChannelSettings[channel].muted);
  }

  /**
   * Finds a radio channel by a given frequency.
   *
   * @param {string} frequency - The frequency to search for.
   * @returns {number | undefined} The channel number if found, undefined otherwise.
   */
  findRadioChannelByFrequency(frequency: string): number | undefined {
    let foundChannel;
    for (const channel in this.radioChannelSettings) {
      const data = this.radioChannelSettings[channel];
      if (data.frequency == frequency) {
        foundChannel = parseInt(channel);
        break;
      }
    }

    return foundChannel;
  }

  setRadioFrequency(channel: number, frequency: string) {
    this.radioFrequenceSetted = true;

    if (this.radioChannelSettings[channel].frequency != frequency) {
      this.disableRadioFromPlayerInChannel(channel);
    }

    this.radioChannelSettings[channel].frequency = frequency;
  }

  /**
   * Disable radio effect for all players in the given channel.
   *
   * @param {number} channel - The channel number.
   */
  disableRadioFromPlayerInChannel(channel: number) {
    if (!this.playersInRadioChannel.has(channel)) return;

    const players = this.playersInRadioChannel.get(channel);
    if (!players?.size) return;

    const targets = [];
    for (const playerId of players) {
      const player = this.getPlayerByID(playerId);
      if (!player || !player.remoteID) continue;

      targets.push(player);
      players.delete(player.remoteID);
    }

    if (targets.length)
      YaCAClientModule.setPlayersCommType(
        targets,
        YacaFilterEnum.RADIO,
        false,
        channel,
        undefined,
        CommDeviceMode.RECEIVER,
        CommDeviceMode.SENDER,
      );
  }

  /**
   * Starts the radio talking state.
   *
   * @param {boolean} state - The state of the radio talking.
   * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
   */
  radioTalkingStart(state: boolean, clearPedTasks: boolean = true) {
    if (!state) {
      if (this.radioTalking) {
        this.radioTalking = false;
        if (!this.useWhisper) this.radioTalkingStateToPlugin(false);
        emitNet("server:yaca:radioTalking", false);
        // this.webview.emit('webview:hud:isRadioTalking', false);
        if (clearPedTasks)
          StopAnimTask(cache.ped, "random@arrests", "generic_radio_chatter", 4);
      }

      return;
    }

    if (!this.radioEnabled || !this.radioFrequenceSetted || this.radioTalking)
      return;

    this.radioTalking = true;
    if (!this.useWhisper) this.radioTalkingStateToPlugin(true);

    requestAnimDict("random@arrests").then(() => {
      TaskPlayAnim(
        cache.ped,
        "random@arrests",
        "generic_radio_chatter",
        3,
        -4,
        -1,
        49,
        0.0,
        false,
        false,
        false,
      );

      emitNet("server:yaca:radioTalking", true);
      // this.webview.emit('webview:hud:isRadioTalking', true);
    });
  }

  /* ======================== PHONE SYSTEM ======================== */

  /**
   * Removes the phone speaker effect from a player entity.
   *
   * @param {number} player - The player entity from which the phone speaker effect is to be removed.
   */
  removePhoneSpeakerFromEntity(player: number) {
    const entityData = this.getPlayerByID(player);
    if (!entityData?.phoneCallMemberIds) return;

    const playersToSet = [];
    for (const phoneCallMemberId of entityData.phoneCallMemberIds) {
      const phoneCallMember = this.getPlayerByID(phoneCallMemberId);
      if (!phoneCallMember) continue;

      playersToSet.push(phoneCallMember);
    }

    YaCAClientModule.setPlayersCommType(
      playersToSet,
      YacaFilterEnum.PHONE_SPEAKER,
      false,
    );

    delete entityData.phoneCallMemberIds;
  }

  /* ======================== MEGAPHONE SYSTEM ======================== */
  /**
   * Toggles the use of the megaphone.
   *
   * @param {boolean} [state=false] - The state of the megaphone. Defaults to false if not provided.
   */
  useMegaphone(state: boolean = false) {
    if (
      (!cache.vehicle && !this.playerLocalPlugin.canUseMegaphone) ||
      state == this.playerLocalPlugin.lastMegaphoneState
    )
      return;

    this.playerLocalPlugin.lastMegaphoneState =
      !this.playerLocalPlugin.lastMegaphoneState;
    emitNet("server:yaca:useMegaphone", state);
  }
}
