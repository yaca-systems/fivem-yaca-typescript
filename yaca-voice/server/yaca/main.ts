import { initLocale, cache, addCommand } from "@overextended/ox_lib/server";
import { generateRandomName } from "utils";
import type { DataObject, YacaServerConfig, YacaSharedConfig } from "types";
import {
  YaCAServerMegaphoneModule,
  YaCAServerRadioModule,
  YaCAServerPhoneModle,
} from "yaca";
import { YaCAServerSaltyChatBridge } from "../bridge/saltychat";

initLocale();

export interface YaCAPlayer {
  voiceSettings: {
    voiceRange: number;
    voiceFirstConnect: boolean;
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
  voicePlugin?: {
    clientId: number;
    forceMuted: boolean;
    range: number;
    playerId: number;
    mutedOnPhone: boolean;
  };
}

export class YaCAServerModule {
  nameSet: Set<string> = new Set();
  players: Map<number, YaCAPlayer> = new Map();

  serverConfig: YacaServerConfig;
  sharedConfig: YacaSharedConfig;

  phoneModule: YaCAServerPhoneModle;
  radioModule: YaCAServerRadioModule;
  megaphoneModule: YaCAServerMegaphoneModule;

  saltChatBridge?: YaCAServerSaltyChatBridge;

  constructor() {
    console.log("~g~ --> YaCA: Server loaded");

    this.serverConfig = JSON.parse(
      LoadResourceFile(cache.resource, `config/server.json`),
    );

    this.sharedConfig = JSON.parse(
      LoadResourceFile(cache.resource, `config/shared.json`),
    );

    this.phoneModule = new YaCAServerPhoneModle(this);
    this.radioModule = new YaCAServerRadioModule(this);
    this.megaphoneModule = new YaCAServerMegaphoneModule(this);

    this.registerExports();
    this.registerEvents();
    this.registerCommands();

    if (this.sharedConfig.saltyChatBridge) {
      this.sharedConfig.radio.maxChannels = 2;
      this.saltChatBridge = new YaCAServerSaltyChatBridge(this);
    }
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
    const name = generateRandomName(src, this.nameSet);
    if (!name) return;

    this.players.set(src, {
      voiceSettings: {
        voiceRange:
          this.sharedConfig.voiceRange.ranges[
            this.sharedConfig.voiceRange.defaultIndex
          ],
        voiceFirstConnect: false,
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

  registerExports() {
    /**
     * Get the alive status of a player.
     *
     * @param {number} playerId - The ID of the player to get the alive status for.
     * @returns {boolean} - The alive status of the player.
     */
    exports("getPlayerAliveStatus", (playerId: number) =>
      this.getPlayerAliveStatus(playerId),
    );

    /**
     * Set the alive status of a player.
     *
     * @param {number} playerId - The ID of the player to set the alive status for.
     * @param {boolean} state - The new alive status.
     */
    exports("setPlayerAliveStatus", (playerId: number, state: boolean) =>
      this.changePlayerAliveStatus(playerId, state),
    );

    /**
     * Get the voice range of a player.
     *
     * @param {number} playerId - The ID of the player to get the voice range for.
     * @returns {number} - The voice range of the player.
     */
    exports("getPlayerVoiceRange", (playerId: number) =>
      this.getPlayerVoiceRange(playerId),
    );

    /**
     * Set the voice range of a player.
     *
     * @param {number} playerId - The ID of the player to set the voice range for.
     */
    exports("setPlayerVoiceRange", (playerId: number, range: number) =>
      this.changeVoiceRange(playerId, range),
    );
  }

  registerEvents() {
    on("playerJoining", (src: number) => {
      this.connectToVoice(src);
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

    // YaCA:successful voice connection and client-id sync
    onNet("server:yaca:addPlayer", (clientId: number) => {
      this.addNewPlayer(source, clientId);
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
      async (_src, args) => {
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
      async (src, args) => {
        this.phoneModule.callPlayer(src, args.playerId, args.state == "true");
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
      async (src, args) => {
        this.phoneModule.callPlayerOldEffect(
          src,
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
      async (_src, args) => {
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
      async (src, args) => {
        this.phoneModule.enablePhoneSpeaker(src, args.state == "true");
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
      async (src, args) => {
        emitNet(
          "client:yaca:addRemovePlayerIntercomFilter",
          src,
          [args.playerId],
          args.state == "true",
        );
        emitNet(
          "client:yaca:addRemovePlayerIntercomFilter",
          args.playerId,
          [src],
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

    this.nameSet.delete(player.voiceSettings?.ingameName);

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

    if (player.voicePlugin) player.voicePlugin.forceMuted = !alive;
  }

  /**
   * Get the alive status of a player.
   *
   * @param playerId - The ID of the player to get the alive status for.
   */
  getPlayerAliveStatus(playerId: number) {
    return this.players.get(playerId)?.voiceSettings.forceMuted ?? false;
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
      const name = generateRandomName(src, this.nameSet);
      if (!name) return;

      this.nameSet.delete(player.voiceSettings?.ingameName);
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

    if (!this.sharedConfig.voiceRange.ranges.includes(range)) {
      return emitNet(
        "client:yaca:setMaxVoiceRange",
        src,
        this.sharedConfig.voiceRange.ranges[
          this.sharedConfig.voiceRange.defaultIndex
        ],
      );
    }

    player.voiceSettings.voiceRange = range;
    emitNet(
      "client:yaca:changeVoiceRange",
      -1,
      src,
      player.voiceSettings.voiceRange,
    );

    if (player.voicePlugin) player.voicePlugin.range = range;
  }

  /**
   * Get the voice range of a player.
   *
   * @param playerId - The ID of the player to get the voice range for.
   */
  getPlayerVoiceRange(playerId: number) {
    return (
      this.players.get(playerId)?.voiceSettings.voiceRange ??
      this.sharedConfig.voiceRange.ranges[
        this.sharedConfig.voiceRange.defaultIndex
      ]
    );
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

    player.voicePlugin = {
      clientId: clientId,
      forceMuted: player.voiceSettings.forceMuted,
      range: player.voiceSettings.voiceRange,
      playerId: src,
      mutedOnPhone: player.voiceSettings.mutedOnPhone,
    };

    emitNet("client:yaca:addPlayers", -1, player.voicePlugin);

    const allPlayersData = [];
    for (const playerSource of getPlayers()) {
      const playerServer = this.players.get(parseInt(playerSource));
      if (!playerServer) continue;

      if (!playerServer.voicePlugin || parseInt(playerSource) == src) continue;

      allPlayersData.push(playerServer.voicePlugin);
    }

    emitNet("client:yaca:addPlayers", src, allPlayersData);
  }
}
