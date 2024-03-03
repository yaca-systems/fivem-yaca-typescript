import { initLocale, cache, addCommand } from "@overextended/ox_lib/server";
import { generateRandomName } from "../utils";
import type { DataObject, YacaServerConfig, YacaSharedConfig } from "types";
import { YaCAPhoneModle } from "./phone";
import { YaCARadioModule } from "./radio";
import { YaCAMegaphoneModule } from "./megaphone";

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

  serverConfig: YacaServerConfig;
  sharedConfig: YacaSharedConfig;

  phoneModule: YaCAPhoneModle;
  radioModule: YaCARadioModule;
  megaphoneModule: YaCAMegaphoneModule;

  constructor() {
    console.log("~g~ --> YaCA: Server loaded");

    this.serverConfig = JSON.parse(
      LoadResourceFile(cache.resource, `configs/server.json`),
    );

    this.sharedConfig = JSON.parse(
      LoadResourceFile(cache.resource, `configs/shared.json`),
    );

    this.phoneModule = new YaCAPhoneModle(this);
    this.radioModule = new YaCARadioModule(this);
    this.megaphoneModule = new YaCAMegaphoneModule(this);

    this.registerEvents();
    this.registerCommands();
  }

  getPlayers(): Map<number, YaCAPlayer> {
    return this.players;
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
      this.megaphoneModule.playerUseMegaphone(source, state);
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
      this.radioModule.enableRadio(source, state);
    });

    //YaCA-Radio: Change radio channel frequency
    onNet(
      "server:yaca:changeRadioFrequency",
      (channel: number, frequency: string) => {
        this.radioModule.changeRadioFrequency(source, channel, frequency);
      },
    );

    //YaCA-Radio: Mute a radio channel
    onNet("server:yaca:muteRadioChannel", (channel: number) => {
      this.radioModule.radioChannelMute(source, channel);
    });

    //YaCA-Radio: Talk in radio channel
    onNet("server:yaca:radioTalking", (state: boolean) => {
      this.radioModule.radioTalkingState(source, state);
    });

    //YaCA-Radio: Change active radio channel
    onNet("server:yaca:changeActiveRadioChannel", (channel: number) => {
      this.radioModule.radioActiveChannelChange(source, channel);
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
        this.phoneModule.callPlayer(
          source,
          args.playerId,
          args.state == "true",
        );
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
        this.phoneModule.callPlayerOldEffect(
          source,
          args.playerId,
          args.state == "true",
        );
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
        this.phoneModule.muteOnPhone(args.playerId, args.state == "true");
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
        this.phoneModule.enablePhoneSpeaker(source, args.state == "true");
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

    const allFrequences = this.radioModule.radioFrequencyMap;
    for (const [key, value] of allFrequences) {
      value.delete(src);
      if (!value.size) this.radioModule.radioFrequencyMap.delete(key);
    }

    emitNet("client:yaca:disconnect", -1, src);
  }

  /**
   * Handle various cases if player left a vehicle.
   *
   * @param {number} src - The source-id of the player who left the vehicle.
   */
  handlePlayerLeftVehicle(src: number) {
    this.megaphoneModule.changeMegaphoneState(src, false, true);
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
}
