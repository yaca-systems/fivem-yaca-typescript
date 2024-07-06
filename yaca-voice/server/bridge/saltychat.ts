import { YaCAServerModule } from "../yaca";
import { cache } from "../utils";
import { saltyChatExport } from "common/bridge";

/**
 * The SaltyChat bridge for the server.
 */
export class YaCAServerSaltyChatBridge {
  serverModule: YaCAServerModule;

  private callMap = new Map<string, Set<number>>();

  /**
   * Creates an instance of the SaltyChat bridge.
   *
   * @param {YaCAServerModule} serverModule - The server module.
   */
  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;

    this.registerSaltyChatEvents();

    console.log("[YaCA] SaltyChat bridge loaded");

    on("onResourceStop", (resourceName: string) => {
      if (cache.resource !== resourceName) {
        return;
      }

      emit("onServerResourceStop", "saltychat");
    });
  }

  /**
   * Register SaltyChat events.
   */
  registerSaltyChatEvents() {
    saltyChatExport("GetPlayerAlive", (netId: number) => {
      this.serverModule.getPlayerAliveStatus(netId);
    });

    saltyChatExport("SetPlayerAlive", (netId: number, isAlive: boolean) => {
      this.serverModule.changePlayerAliveStatus(netId, isAlive);
    });

    saltyChatExport("GetPlayerVoiceRange", (netId: number) => {
      this.serverModule.getPlayerVoiceRange(netId);
    });

    saltyChatExport("SetPlayerVoiceRange", (netId: number, voiceRange: number) => {
      this.serverModule.changeVoiceRange(netId, voiceRange);
    });

    saltyChatExport("AddPlayerToCall", (callIdentifier: string, playerHandle: number) => this.addPlayerToCall(callIdentifier, playerHandle));

    saltyChatExport("AddPlayersToCall", (callIdentifier: string, playerHandles: number[]) => this.addPlayerToCall(callIdentifier, playerHandles));

    saltyChatExport("RemovePlayerFromCall", (callIdentifier: string, playerHandle: number) => this.removePlayerFromCall(callIdentifier, playerHandle));

    saltyChatExport("RemovePlayersFromCall", (callIdentifier: string, playerHandles: number[]) => this.removePlayerFromCall(callIdentifier, playerHandles));

    saltyChatExport("SetPhoneSpeaker", (playerHandle: number, toggle: boolean) => {
      this.serverModule.phoneModule.enablePhoneSpeaker(playerHandle, toggle);
    });

    saltyChatExport("SetPlayerRadioSpeaker", () => {
      console.warn("SetPlayerRadioSpeaker is not implemented in YaCA");
    });

    saltyChatExport("GetPlayersInRadioChannel", (radioChannelName: string) => this.serverModule.radioModule.getPlayersInRadioFrequency(radioChannelName));

    saltyChatExport("SetPlayerRadioChannel", (netId: number, radioChannelName: string, primary = true) => {
      const channel = primary ? 1 : 2;
      const newRadioChannelName = radioChannelName === "" ? "0" : radioChannelName;

      this.serverModule.radioModule.changeRadioFrequency(netId, channel, newRadioChannelName);
    });

    saltyChatExport("RemovePlayerRadioChannel", (netId: number, primary: boolean) => {
      const channel = primary ? 1 : 2;
      this.serverModule.radioModule.changeRadioFrequency(netId, channel, "0");
    });

    saltyChatExport("SetRadioTowers", () => {
      console.warn("SetRadioTowers is not implemented in YaCA");
    });

    saltyChatExport("EstablishCall", (callerId: number, targetId: number) => {
      this.serverModule.phoneModule.callPlayer(callerId, targetId, true);
    });

    saltyChatExport("EndCall", (callerId: number, targetId: number) => {
      this.serverModule.phoneModule.callPlayer(callerId, targetId, false);
    });
  }

  /**
   * Add a player to a call.
   *
   * @param callIdentifier - The call identifier.
   * @param playerHandle - The player handles.
   */
  addPlayerToCall(callIdentifier: string, playerHandle: number | number[]) {
    if (!Array.isArray(playerHandle)) {
      playerHandle = [playerHandle];
    }

    const currentlyInCall = this.callMap.get(callIdentifier) ?? new Set<number>();
    const newInCall = new Set<number>();

    for (const player of playerHandle) {
      if (!currentlyInCall.has(player)) {
        currentlyInCall.add(player);
        newInCall.add(player);
      }
    }

    this.callMap.set(callIdentifier, currentlyInCall);

    for (const player of currentlyInCall) {
      for (const otherPlayer of newInCall) {
        if (player !== otherPlayer) {
          this.serverModule.phoneModule.callPlayer(player, otherPlayer, true);
        }
      }
    }
  }

  /**
   * Remove a player from a call.
   *
   * @param callIdentifier - The call identifier.
   * @param playerHandle - The player handles.
   */
  removePlayerFromCall(callIdentifier: string, playerHandle: number | number[]) {
    if (!Array.isArray(playerHandle)) {
      playerHandle = [playerHandle];
    }

    const beforeInCall = this.callMap.get(callIdentifier);
    if (!beforeInCall) {
      return;
    }

    const nowInCall = new Set<number>(beforeInCall);

    const removedFromCall = new Set<number>();
    for (const player of playerHandle) {
      if (beforeInCall.has(player)) {
        nowInCall.delete(player);
        removedFromCall.add(player);
      }
    }

    this.callMap.set(callIdentifier, nowInCall);

    for (const player of removedFromCall) {
      for (const otherPlayer of beforeInCall) {
        if (player !== otherPlayer) {
          this.serverModule.phoneModule.callPlayer(player, otherPlayer, false);
        }
      }
    }
  }
}
