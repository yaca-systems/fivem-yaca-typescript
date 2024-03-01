import { initLocale, cache } from "@overextended/ox_lib/server";
import { generateRandomName } from "utils";
import type { YacaServerConfig } from "types";

initLocale();

export interface YaCAPlayer {
  voiceSettings: {
    voiceRange: number;
    voiceFirstConnect: boolean;
    forceMuted: boolean;
    ingameName: string;
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
  static players: Map<string, YaCAPlayer> = new Map();

  config: YacaServerConfig;

  constructor() {
    this.config = JSON.parse(
      LoadResourceFile(cache.resource, `configs/server.json`),
    );

    this.registerEvents();
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
   * @param {string} source - The source-id of the player to connect
   */
  connectToVoice(source: string) {
    if (!source) return;

    const name: string | undefined = generateRandomName(source);
    if (!name) return;

    YaCAServerModule.players.set(source, {
      voiceSettings: {
        voiceRange: 25, //TODO: Change this to a config value
        voiceFirstConnect: true,
        forceMuted: false,
        ingameName: name,
        mutedOnPhone: false,
      },
    });

    this.connect(source);
  }

  /**
   * Sends initial data needed to connect to teamspeak plugin.
   *
   * @param {string }source - The source-id of the player to connect
   */
  connect(source: string) {
    const player = YaCAServerModule.players.get(source);
    if (!player) {
      console.error(`YaCA: Missing player data for ${source}.`);
      return;
    }

    player.voiceSettings.voiceFirstConnect = true;

    //TODO: Change this to a config value
    const serverSettings: YaCAServerSettings = {
      uniqueServerId: "1",
      ingameChannelId: 1,
      ingameChannelPassword: "password",
      defaultChannelId: 1,
      useWhisper: true,
      excludeChannels: [1, 2, 3],
    };

    TriggerClientEvent("client:yaca:init", source, serverSettings);
  }

  registerEvents() {
    onNet("server:yaca:nuiReady", this.connectToVoice);
  }
}
