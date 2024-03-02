import { initLocale, cache } from "@overextended/ox_lib/server";
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
  static players: Map<number, YaCAPlayer> = new Map();
  static radioFrequencyMap = new Map();

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

    setTimeout(() => {
      for (const player of getPlayers()) {
        console.log(`Player ${player} is joining.`);
        this.connectToVoice(parseInt(player));
      }
    }, 10000);
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

    YaCAServerModule.players.set(src, {
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
        const player = YaCAServerModule.players.get(source);
        if (!player) return;

        const enableWhisperReceive: number[] = [];
        const disableWhisperReceive: number[] = [];

        player.voiceSettings.inCallWith.forEach((callTarget) => {
          const target = YaCAServerModule.players.get(callTarget);
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
   * Handle various cases if player disconnects.
   *
   * @param {number} src - The source-id of the player who disconnected.
   */
  handlePlayerDisconnect(src: number) {
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    YaCAServerModule.nameSet.delete(player.voiceSettings?.ingameName);

    const allFrequences = YaCAServerModule.radioFrequencyMap;
    for (const [key, value] of allFrequences) {
      value.delete(src);
      if (!value.size) YaCAServerModule.radioFrequencyMap.delete(key);
    }

    emitNet("client:yaca:disconnect", -1, src);
  }

  /**
   * Handle various cases if player left a vehicle.
   *
   * @param {number} src - The source-id of the player who left the vehicle.
   */
  handlePlayerLeftVehicle(src: number) {
    YaCAServerModule.changeMegaphoneState(src, false, true);
  }

  /**
   * Syncs player alive status and mute him if he is dead or whatever.
   *
   * @param {number} src - The source-id of the player to sync.
   * @param {boolean} alive - The new alive status.
   */
  static changePlayerAliveStatus(src: number, alive: boolean) {
    const player = YaCAServerModule.players.get(src);
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
    const player = YaCAServerModule.players.get(src);
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

    YaCAServerModule.changeMegaphoneState(src, state);
  }

  /**
   * Apply the megaphone effect on a specific player.
   *
   * @param {number} src - The source-id of the player to apply the megaphone effect to.
   * @param {boolean} state - The state of the megaphone effect.
   * @param {boolean} [forced=false] - Whether the change is forced. Defaults to false if not provided.
   */
  static changeMegaphoneState(
    src: number,
    state: boolean,
    forced: boolean = false,
  ) {
    const playerState = Player(src).state;

    if (!state && playerState["yaca:megaphoneactive"]) {
      playerState.set("yaca:megaphoneactive", null, true);
      if (forced) console.log("TODO"); // player.setLocalMeta("lastMegaphoneState", false); // TODO: Implement this
    } else if (state && !playerState["yaca:megaphoneactive"]) {
      playerState.set("yaca:megaphoneactive", 30, true);
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
    const player = YaCAServerModule.players.get(src);
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
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    // Sanitycheck to prevent hackers or shit
    if (player.voiceSettings.maxVoiceRangeInMeter < range)
      return emitNet("client:yaca:setMaxVoiceRange", src, 15);

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
    const player = YaCAServerModule.players.get(src);
    if (!player) {
      console.error(`YaCA: Missing player data for ${src}.`);
      return;
    }

    player.voiceSettings.voiceFirstConnect = true;

    //TODO: Change this to a config value
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
    const player = YaCAServerModule.players.get(src);
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
      const playerServer = YaCAServerModule.players.get(parseInt(playerSource));
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
  static isLongRadioPermitted(src: number) {
    if (!src) return;

    const player = YaCAServerModule.players.get(src);
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
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    player.radioSettings.activated = state;
    YaCAServerModule.isLongRadioPermitted(src);
  }

  /**
   * Change the radio frequency for a player.
   *
   * @param {number} src - The player to change the radio frequency for.
   * @param {number} channel - The channel to change the frequency of.
   * @param {string} frequency - The new frequency.
   */
  changeRadioFrequency(src: number, channel: number, frequency: string) {
    const player = YaCAServerModule.players.get(src);
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
    if (!YaCAServerModule.radioFrequencyMap.has(frequency))
      YaCAServerModule.radioFrequencyMap.set(frequency, new Map());
    YaCAServerModule.radioFrequencyMap
      .get(frequency)
      .set(source, { muted: false });

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
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    frequency =
      frequency == "0" ? player.radioSettings.frequencies[channel] : frequency;

    if (!YaCAServerModule.radioFrequencyMap.has(frequency)) return;

    const allPlayersInChannel =
      YaCAServerModule.radioFrequencyMap.get(frequency);

    player.radioSettings.frequencies[channel] = "0";

    const players = [];
    const allTargets = [];
    for (const [key] of allPlayersInChannel) {
      const target = YaCAServerModule.players.get(key);
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
    if (!YaCAServerModule.radioFrequencyMap.get(frequency).size)
      YaCAServerModule.radioFrequencyMap.delete(frequency);
  }

  /**
   * Mute a radio channel for a player.
   *
   * @param {number} src - The player to mute the radio channel for.
   * @param {number} channel - The channel to mute.
   */
  radioChannelMute(src: number, channel: number) {
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    const radioFrequency = player.radioSettings.frequencies[channel];
    const foundPlayer = YaCAServerModule.radioFrequencyMap
      .get(radioFrequency)
      ?.get(src);
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
    const player = YaCAServerModule.players.get(src);
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
    const player = YaCAServerModule.players.get(src);
    if (!player || !player.radioSettings.activated) return;

    const radioFrequency =
      player.radioSettings.frequencies[player.radioSettings.currentChannel];
    if (!radioFrequency) return;

    const getPlayers = YaCAServerModule.radioFrequencyMap.get(radioFrequency);
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

      const target = YaCAServerModule.players.get(key);
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
    const player = YaCAServerModule.players.get(src);
    const targetPlayer = YaCAServerModule.players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phone", target, src, state);
    emitNet("client:yaca:phone", src, target, state);

    if (!state) {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);
    } else {
      const playerState = Player(src).state;
      if (playerState["yaca:phoneSpeaker"])
        this.enablePhoneSpeaker(src, true, [src, target]);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);
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
    const player = YaCAServerModule.players.get(src);
    const targetPlayer = YaCAServerModule.players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phoneOld", target, src, state);
    emitNet("client:yaca:phoneOld", src, target, state);

    if (!state) {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);
    } else {
      const playerState = Player(src).state;
      if (playerState["yaca:phoneSpeaker"])
        this.enablePhoneSpeaker(src, true, [src, target]);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);
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
    const player = YaCAServerModule.players.get(src);
    if (!player) return;

    player.voiceSettings.mutedOnPhone = state;
    emitNet("client:yaca:phoneMute", -1, src, state, onCallStop);
  }

  /**
   * Enable or disable the phone speaker for a player.
   *
   * @param {number} src - The source-id of the player to enable the phone speaker for.
   * @param {boolean} state - The state of the phone speaker.
   * @param {number[]} phoneCallMemberIds - The IDs of the members in the phone call.
   */
  enablePhoneSpeaker(
    src: number,
    state: boolean,
    phoneCallMemberIds: number[],
  ) {
    const playerState = Player(src).state;

    if (state) {
      playerState.set("yaca:phoneSpeaker", phoneCallMemberIds, true);
    } else {
      playerState.set("yaca:phoneSpeaker", null, true);
    }
  }
}
