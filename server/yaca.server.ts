import { initLocale, cache, addCommand } from "@overextended/ox_lib/server";
import { generateRandomName } from "utils";
import type { DataObject, YacaServerConfig, YacaSharedConfig } from "types";

initLocale();

export interface YaCAPlayer {
  voiceSettings: {
    voiceRange: number;
    voiceFirstConnect: boolean;
    maxVoiceRangeInMeter: number;
    forceMuted: boolean;
    ingameName: string;
    mutedOnPhone: boolean;
    inCallWith: number[];
  };
  radioSettings: {
    activated: boolean;
    currentChannel: number;
    hasLong: boolean;
    frequencies: { [key: number]: string };
  };
  voiceplugin?: {
    clientId: number;
    forceMuted: boolean;
    range: number;
    playerId: number;
    mutedOnPhone: boolean;
  };
}

export interface YaCAServerSettings {
  uniqueServerId: string; // Unique TeamSpeak-Server ID
  ingameChannelId: number; // Channel ID of the ingame channel
  ingameChannelPassword: string; // Password of the ingame channel
  defaultChannelId: number; // efault Teamspeak Channel, if player can't be moved back to his old channel
  useWhisper: boolean; // If true, it will use the teamspeak whisper system
  excludeChannels: number[]; // Channel ID's where users can be in while being ingame and won't be moved into the ingame channel
}

export class YaCAServerModule {
  static instance: YaCAServerModule;
  static nameSet: Set<string> = new Set();
  players: Map<number, YaCAPlayer> = new Map();
  radioFrequencyMap = new Map();

  serverConfig: YacaServerConfig;
  sharedConfig: YacaSharedConfig;

  constructor() {
    console.log("~g~ --> YaCA: Server loaded");

    this.serverConfig = JSON.parse(
      LoadResourceFile(cache.resource, `configs/server.json`),
    );

    this.sharedConfig = JSON.parse(
      LoadResourceFile(cache.resource, `configs/shared.json`),
    );

    this.registerEvents();
    this.registerCommands();
  }

  /**
   * Gets the singleton of YaCAServerModule.
   *
   * @returns {YaCAServerModule} The singleton instance of YaCAServerModule.
   */
  static getInstance(): YaCAServerModule {
    if (!this.instance) {
      this.instance = new YaCAServerModule();
    }

    return this.instance;
  }

  /**
   * Initialize the player on first connect.
   *
   * @param {number} src - The source-id of the player to initialize.
   */
  connectToVoice(src: number) {
    const name = generateRandomName(src);
    if (!name) return;

    this.players.set(src, {
      voiceSettings: {
        voiceRange: 3, //TODO: Change this to a config value
        voiceFirstConnect: false,
        maxVoiceRangeInMeter: 15,
        forceMuted: false,
        ingameName: name,
        mutedOnPhone: false,
        inCallWith: [],
      },
      radioSettings: {
        activated: false,
        currentChannel: 1,
        hasLong: false,
        frequencies: {},
      },
    });

    this.connect(src);
  }

  registerEvents() {
    on("playerJoining", (source: number) => {
      this.connectToVoice(source);
    });

    on("playerDropped", () => {
      this.handlePlayerDisconnect(source);
    });

    onNet("server:yaca:playerLeftVehicle", () => {
      this.handlePlayerLeftVehicle(source);
    });

    onNet("server:yaca:nuiReady", () => {
      this.connectToVoice(source);
    });

    // YaCA: voice range toggle
    onNet("server:yaca:changeVoiceRange", (range: number) => {
      this.changeVoiceRange(source, range);
    });

    // YACA: Playerlipsync
    onNet("server:yaca:lipsync", (state: boolean) => {
      const playerState = Player(source).state;

      playerState.set("yaca:lipsync", state, true);
    });

    // YaCA:successful voice connection and client-id sync
    onNet("server:yaca:addPlayer", (clientId: number) => {
      this.addNewPlayer(source, clientId);
    });

    // YaCA: Change megaphone state by player
    onNet("server:yaca:useMegaphone", (state: boolean) => {
      this.playerUseMegaphone(source, state);
    });

    // YaCA: Triggers if voiceplugin is for x amount of time not connected
    onNet("server:yaca:noVoicePlugin", () => {
      this.playerNoVoicePlugin(source);
    });

    //YaCa: voice restart
    onNet("server:yaca:wsReady", (isFirstConnect: boolean) => {
      console.log(`Player ${source} is ready for voice.`);
      this.playerReconnect(source, isFirstConnect);
    });

    //YaCA: Enable radio
    onNet("server:yaca:enableRadio", (state: boolean) => {
      this.enableRadio(source, state);
    });

    //YaCA-Radio: Change radio channel frequency
    onNet(
      "server:yaca:changeRadioFrequency",
      (channel: number, frequency: string) => {
        this.changeRadioFrequency(source, channel, frequency);
      },
    );

    //YaCA-Radio: Mute a radio channel
    onNet("server:yaca:muteRadioChannel", (channel: number) => {
      this.radioChannelMute(source, channel);
    });

    //YaCA-Radio: Talk in radio channel
    onNet("server:yaca:radioTalking", (state: boolean) => {
      this.radioTalkingState(source, state);
    });

    //YaCA-Radio: Change active radio channel
    onNet("server:yaca:changeActiveRadioChannel", (channel: number) => {
      this.radioActiveChannelChange(source, channel);
    });

    onNet(
      "server:yaca:phoneSpeakerEmit",
      (enableForTargets?: number[], disableForTargets?: number[]) => {
        const player = this.players.get(source);
        if (!player) return;

        const enableWhisperReceive: number[] = [];
        const disableWhisperReceive: number[] = [];

        player.voiceSettings.inCallWith.forEach((callTarget) => {
          const target = this.players.get(callTarget);
          if (!target) return;

          if (enableForTargets?.includes(callTarget))
            enableWhisperReceive.push(callTarget);
          if (disableForTargets?.includes(callTarget))
            disableWhisperReceive.push(callTarget);
        });

        if (enableWhisperReceive.length) {
          for (const target of enableWhisperReceive) {
            emitNet(
              "client:yaca:playersToPhoneSpeakerEmit",
              target,
              enableForTargets,
              true,
            );
          }
        }
        if (disableWhisperReceive.length) {
          for (const target of disableWhisperReceive) {
            emitNet(
              "client:yaca:playersToPhoneSpeakerEmit",
              target,
              disableForTargets,
              false,
            );
          }
        }
      },
    );

    onNet("server:yaca:nuiReady", () => {
      this.connectToVoice(source);
    });
  }

  /**
   * Register the commands for the YaCA server module.
   * This is only done if the debug mode is enabled.
   */
  registerCommands() {
    if (!this.sharedConfig.debug) return;

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "setAlive",
      async (source, args) => {
        this.changePlayerAliveStatus(args.playerId, args.state == "true");
      },
      {
        help: "Set the alive status of a player.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to set the alive status for.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The new alive status.",
            paramType: "string",
          },
        ],
      },
    );

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "callPlayer",
      async (source, args) => {
        this.callPlayer(source, args.playerId, args.state == "true");
      },
      {
        help: "Call another player.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to call.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The state of the call.",
            paramType: "string",
          },
        ],
      },
    );

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "callPlayerOld",
      async (source, args) => {
        this.callPlayerOldEffect(source, args.playerId, args.state == "true");
      },
      {
        help: "Call another player on old phone.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to call.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The state of the call.",
            paramType: "string",
          },
        ],
      },
    );

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "muteOnPhone",
      async (source, args) => {
        this.muteOnPhone(args.playerId, args.state == "true");
      },
      {
        help: "Mute a player during a phone call.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to mute.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The mute state.",
            paramType: "string",
          },
        ],
      },
    );

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "enablePhoneSpeaker",
      async (source, args) => {
        this.enablePhoneSpeaker(source, args.state == "true");
      },
      {
        help: "Enable or disable the phone speaker for a player.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to enable the phone speaker for.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The state of the phone speaker.",
            paramType: "string",
          },
        ],
      },
    );

    addCommand<{
      playerId: number;
      state: string;
    }>(
      "intercom",
      async (source, args) => {
        emitNet(
          "client:yaca:addRemovePlayerIntercomFilter",
          source,
          [args.playerId, source],
          args.state == "true",
        );
        emitNet(
          "client:yaca:addRemovePlayerIntercomFilter",
          args.playerId,
          [args.playerId, source],
          args.state == "true",
        );
      },
      {
        help: "Enable or disable the intercom for a player.",
        params: [
          {
            name: "playerId",
            help: "The ID of the player to enable the intercom for.",
            paramType: "playerId",
          },
          {
            name: "state",
            help: "The state of the intercom.",
            paramType: "string",
          },
        ],
      },
    );
  }

  /**
   * Handle various cases if player disconnects.
   *
   * @param {number} src - The source-id of the player who disconnected.
   */
  handlePlayerDisconnect(src: number) {
    const player = this.players.get(src);
    if (!player) return;

    YaCAServerModule.nameSet.delete(player.voiceSettings?.ingameName);

    const allFrequences = this.radioFrequencyMap;
    for (const [key, value] of allFrequences) {
      value.delete(src);
      if (!value.size) this.radioFrequencyMap.delete(key);
    }

    emitNet("client:yaca:disconnect", -1, src);
  }

  /**
   * Handle various cases if player left a vehicle.
   *
   * @param {number} src - The source-id of the player who left the vehicle.
   */
  handlePlayerLeftVehicle(src: number) {
    this.changeMegaphoneState(src, false, true);
  }

  /**
   * Syncs player alive status and mute him if he is dead or whatever.
   *
   * @param {number} src - The source-id of the player to sync.
   * @param {boolean} alive - The new alive status.
   */
  changePlayerAliveStatus(src: number, alive: boolean) {
    const player = this.players.get(src);
    if (!player) return;

    player.voiceSettings.forceMuted = !alive;
    emitNet("client:yaca:muteTarget", -1, src, !alive);

    if (player.voiceplugin) player.voiceplugin.forceMuted = !alive;
  }

  /**
   * Apply the megaphone effect on a specific player via client event.
   *
   * @param {number} src - The source-id of the player to apply the megaphone effect to.
   * @param {boolean} state - The state of the megaphone effect.
   */
  playerUseMegaphone(src: number, state: boolean) {
    const player = this.players.get(src);
    if (!player) return;

    const playerState = Player(src).state;
    const playerPed = GetPlayerPed(src.toString());
    const playerVehicle = GetVehiclePedIsIn(playerPed, false);

    if (playerVehicle == 0 && playerState["yaca:megaphoneactive"]) return;
    if (playerVehicle != 0) {
      const playerSeatDriver = GetPedInVehicleSeat(playerVehicle, -1);
      const playerSeatPassenger = GetPedInVehicleSeat(playerVehicle, 0);
      if (playerSeatDriver != playerPed && playerSeatPassenger != playerPed)
        return;
    }
    if (
      (!state && !playerState["yaca:megaphoneactive"]) ||
      (state && playerState["yaca:megaphoneactive"])
    )
      return;

    this.changeMegaphoneState(src, state);
  }

  /**
   * Apply the megaphone effect on a specific player.
   *
   * @param {number} src - The source-id of the player to apply the megaphone effect to.
   * @param {boolean} state - The state of the megaphone effect.
   * @param {boolean} [forced=false] - Whether the change is forced. Defaults to false if not provided.
   */
  changeMegaphoneState(src: number, state: boolean, forced: boolean = false) {
    const playerState = Player(src).state;

    if (!state && playerState["yaca:megaphoneactive"]) {
      playerState.set("yaca:megaphoneactive", null, true);
      if (forced) emitNet("client:yaca:setLastMegaphoneState", src, false);
    } else if (state && !playerState["yaca:megaphoneactive"]) {
      playerState.set(
        "yaca:megaphoneactive",
        this.serverConfig.megaPhoneRange,
        true,
      );
    }
  }

  /**
   * Kick player if he doesn't have the voice plugin activated.
   *
   * @param {number} src - The player to check for the voice plugin.
   */
  playerNoVoicePlugin(src: number) {
    DropPlayer(src.toString(), "Dein Voiceplugin war nicht aktiviert!");
  }

  /**
   * Used if a player reconnects to the server.
   *
   * @param {number} src - The source-id of the player to reconnect.
   * @param {boolean} isFirstConnect - Whether this is the player's first connection.
   */
  playerReconnect(src: number, isFirstConnect: boolean) {
    const player = this.players.get(src);
    if (!player) return;

    if (!player.voiceSettings.voiceFirstConnect) return;

    if (!isFirstConnect) {
      const name = generateRandomName(src);
      if (!name) return;

      YaCAServerModule.nameSet.delete(player.voiceSettings?.ingameName);
      player.voiceSettings.ingameName = name;
    }

    this.connect(src);
  }

  /**
   * Change the voice range of a player.
   *
   * @param {number} src - The source-id of the player to change the voice range for.
   * @param {number} range - The new voice range.
   */
  changeVoiceRange(src: number, range: number) {
    const player = this.players.get(src);
    if (!player) return;

    if (!this.sharedConfig.voiceRanges.includes(range)) {
      return emitNet(
        "client:yaca:setMaxVoiceRange",
        src,
        this.sharedConfig.voiceRanges[this.sharedConfig.defaultVoiceRangeIndex],
      );
    }

    player.voiceSettings.voiceRange = range;
    emitNet(
      "client:yaca:changeVoiceRange",
      -1,
      src,
      player.voiceSettings.voiceRange,
    );

    if (player.voiceplugin) player.voiceplugin.range = range;
  }

  /**
   * Sends initial data needed to connect to teamspeak plugin.
   *
   * @param {number} src - The source-id of the player to connect
   */
  connect(src: number) {
    const player = this.players.get(src);
    if (!player) {
      console.error(`YaCA: Missing player data for ${src}.`);
      return;
    }

    player.voiceSettings.voiceFirstConnect = true;

    const initObject: DataObject = {
      suid: this.serverConfig.uniqueServerId,
      chid: this.serverConfig.ingameChannelId,
      deChid: this.serverConfig.defaultChannelId,
      channelPassword: this.serverConfig.ingameChannelPassword,
      ingameName: player.voiceSettings.ingameName,
      useWhisper: this.serverConfig.useWhisper,
      excludeChannels: this.serverConfig.excludeChannels,
    };
    emitNet("client:yaca:init", src, initObject);
  }

  /**
   * Add new player to all other players on connect or reconnect, so they know about some variables.
   *
   * @param src - The source-id of the player to add.
   * @param {number} clientId - The client ID of the player.
   */
  addNewPlayer(src: number, clientId: number) {
    const player = this.players.get(src);
    if (!player || !clientId) return;

    player.voiceplugin = {
      clientId: clientId,
      forceMuted: player.voiceSettings.forceMuted,
      range: player.voiceSettings.voiceRange,
      playerId: source,
      mutedOnPhone: player.voiceSettings.mutedOnPhone,
    };

    emitNet("client:yaca:addPlayers", -1, player.voiceplugin);

    const allPlayersData = [];
    for (const playerSource of getPlayers()) {
      const playerServer = this.players.get(parseInt(playerSource));
      if (!playerServer) continue;

      if (!playerServer.voiceplugin || parseInt(playerSource) == src) continue;

      allPlayersData.push(playerServer.voiceplugin);
    }

    emitNet("client:yaca:addPlayers", src, allPlayersData);
  }

  /* ======================== RADIO SYSTEM ======================== */
  /**
   * Checks if a player is permitted to use long radio.
   */
  isLongRadioPermitted(src: number) {
    if (!src) return;

    const player = this.players.get(src);
    if (!player) return;

    player.radioSettings.hasLong = true; //Add some checks if you want shortrange system;
  }

  /**
   * Enable or disable the radio for a player.
   *
   * @param {number} src - The player to enable or disable the radio for.
   * @param {boolean} state - The new state of the radio.
   */
  enableRadio(src: number, state: boolean) {
    const player = this.players.get(src);
    if (!player) return;

    player.radioSettings.activated = state;
    this.isLongRadioPermitted(src);
  }

  /**
   * Change the radio frequency for a player.
   *
   * @param {number} src - The player to change the radio frequency for.
   * @param {number} channel - The channel to change the frequency of.
   * @param {string} frequency - The new frequency.
   */
  changeRadioFrequency(src: number, channel: number, frequency: string) {
    const player = this.players.get(src);
    if (!player) return;

    if (!player.radioSettings.activated)
      return emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Das Funkgerät ist aus!",
      });
    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    )
      return emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Fehlerhafter Funk Kanal!",
      });

    // Leave radiochannel if frequency is 0
    if (frequency == "0")
      return YaCAServerModule.getInstance().leaveRadioFrequency(
        src,
        channel,
        frequency,
      );

    if (player.radioSettings.frequencies[channel] != frequency) {
      YaCAServerModule.getInstance().leaveRadioFrequency(
        src,
        channel,
        player.radioSettings.frequencies[channel],
      );
    }

    // Add player to channel map, so we know who is in which channel
    if (!this.radioFrequencyMap.has(frequency))
      this.radioFrequencyMap.set(frequency, new Map());
    this.radioFrequencyMap.get(frequency).set(source, { muted: false });

    player.radioSettings.frequencies[channel] = frequency;

    emitNet("client:yaca:setRadioFreq", source, channel, frequency);

    //TODO: Add radio effect to player in new frequency
    // const newPlayers = this.getPlayersInRadioFrequency(frequency);
    // if (newPlayers.length) alt.emitClientRaw(newPlayers, "client:yaca:setRadioEffectInFrequency", frequency, player.id);
  }

  /**
   * Make a player leave a radio frequency.
   *
   * @param {number} src - The player to leave the radio frequency.
   * @param {number} channel - The channel to leave.
   * @param {string} frequency - The frequency to leave.
   */
  leaveRadioFrequency(src: number, channel: number, frequency: string) {
    const player = this.players.get(src);
    if (!player) return;

    frequency =
      frequency == "0" ? player.radioSettings.frequencies[channel] : frequency;

    if (!this.radioFrequencyMap.has(frequency)) return;

    const allPlayersInChannel = this.radioFrequencyMap.get(frequency);

    player.radioSettings.frequencies[channel] = "0";

    const players = [];
    const allTargets = [];
    for (const [key] of allPlayersInChannel) {
      const target = this.players.get(key);
      if (!target) continue;

      players.push(key);

      if (key == source) continue;

      allTargets.push(key);
    }

    if (!this.serverConfig.useWhisper && players.length) {
      for (const target of allTargets) {
        if (player.voiceplugin)
          emitNet(
            "client:yaca:leaveRadioChannel",
            target,
            player.voiceplugin.clientId,
            frequency,
          );
      }
    }
    if (this.serverConfig.useWhisper)
      emitNet(
        "client:yaca:radioTalking",
        source,
        allTargets,
        frequency,
        false,
        null,
        true,
      );

    allPlayersInChannel.delete(source);
    if (!this.radioFrequencyMap.get(frequency).size)
      this.radioFrequencyMap.delete(frequency);
  }

  /**
   * Mute a radio channel for a player.
   *
   * @param {number} src - The player to mute the radio channel for.
   * @param {number} channel - The channel to mute.
   */
  radioChannelMute(src: number, channel: number) {
    const player = this.players.get(src);
    if (!player) return;

    const radioFrequency = player.radioSettings.frequencies[channel];
    const foundPlayer = this.radioFrequencyMap.get(radioFrequency)?.get(src);
    if (!foundPlayer) return;

    foundPlayer.muted = !foundPlayer.muted;
    emitNet(
      "client:yaca:setRadioMuteState",
      src,
      radioFrequency,
      foundPlayer.muted,
    );
  }

  /**
   * Change the active radio channel for a player.
   *
   * @param {number} src - The player to change the active channel for.
   * @param {number} channel - The new active channel.
   */
  radioActiveChannelChange(src: number, channel: number) {
    const player = this.players.get(src);
    if (!player) return;

    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    )
      return;

    player.radioSettings.currentChannel = channel;
  }

  /**
   * Change the talking state of a player on the radio.
   *
   * @param {number} src - The player to change the talking state for.
   * @param {boolean} state - The new talking state.
   */
  radioTalkingState(src: number, state: boolean) {
    const player = this.players.get(src);
    if (!player || !player.radioSettings.activated) return;

    const radioFrequency =
      player.radioSettings.frequencies[player.radioSettings.currentChannel];
    if (!radioFrequency) return;

    const getPlayers = this.radioFrequencyMap.get(radioFrequency);
    let targets = [];
    const targetsToSender = [];
    const radioInfos: { [key: number]: { shortRange: boolean } } = {};
    for (const [key, values] of getPlayers) {
      if (values.muted) {
        if (key == source) {
          targets = [];
          break;
        }
        continue;
      }

      if (key == source) continue;

      const target = this.players.get(key);
      if (!target || !target.radioSettings.activated) continue;

      const shortRange =
        !player.radioSettings.hasLong && !target.radioSettings.hasLong;
      if (
        (player.radioSettings.hasLong && target.radioSettings.hasLong) ||
        shortRange
      ) {
        targets.push(key);

        radioInfos[key] = {
          shortRange: shortRange,
        };

        targetsToSender.push(key);
      }
    }

    if (targets.length) {
      for (const target of targets) {
        emitNet(
          "client:yaca:radioTalking",
          target,
          src,
          radioFrequency,
          state,
          radioInfos,
        );
      }
    }
    if (this.serverConfig.useWhisper)
      emitNet(
        "client:yaca:radioTalking",
        src,
        targetsToSender,
        radioFrequency,
        state,
        radioInfos,
        true,
      );
  }

  /* ======================== PHONE SYSTEM ======================== */
  /**
   * Call another player.
   *
   * @param {number} src - The player who is making the call.
   * @param {number} target - The player who is being called.
   * @param {boolean} state - The state of the call.
   */
  callPlayer(src: number, target: number, state: boolean) {
    const player = this.players.get(src);
    const targetPlayer = this.players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phone", target, src, state);
    emitNet("client:yaca:phone", src, target, state);

    const playerState = Player(src).state;

    if (state) {
      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, true);
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, false);
    }
  }

  /**
   * Apply the old effect to a player during a call.
   *
   * @param {number} src - The player to apply the old effect to.
   * @param {number} target - The player on the other end of the call.
   * @param {boolean} state - The state of the call.
   */
  callPlayerOldEffect(src: number, target: number, state: boolean) {
    const player = this.players.get(src);
    const targetPlayer = this.players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phoneOld", target, src, state);
    emitNet("client:yaca:phoneOld", src, target, state);

    const playerState = Player(src).state;

    if (state) {
      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, true);
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, false);
    }
  }

  /**
   * Mute a player during a phone call.
   *
   * @param {number} src - The source-id of the player to mute.
   * @param {boolean} state - The mute state.
   * @param {boolean} [onCallStop=false] - Whether the call has stopped. Defaults to false if not provided.
   */
  muteOnPhone(src: number, state: boolean, onCallStop: boolean = false) {
    const player = this.players.get(src);
    if (!player) return;

    player.voiceSettings.mutedOnPhone = state;
    emitNet("client:yaca:phoneMute", -1, src, state, onCallStop);
  }

  /**
   * Enable or disable the phone speaker for a player.
   *
   * @param {number} src - The source-id of the player to enable the phone speaker for.
   * @param {boolean} state - The state of the phone speaker.
   */
  enablePhoneSpeaker(src: number, state: boolean) {
    const player = this.players.get(src);
    if (!player) return;

    const playerState = Player(src).state;

    if (state && player.voiceSettings.inCallWith.length) {
      playerState.set(
        "yaca:phoneSpeaker",
        player.voiceSettings.inCallWith,
        true,
      );
    } else {
      playerState.set("yaca:phoneSpeaker", null, true);
    }
  }
}
