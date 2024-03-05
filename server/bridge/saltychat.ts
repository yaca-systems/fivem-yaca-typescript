import { YaCAServerModule } from "../yaca";
import { cache } from "@overextended/ox_lib/server";

export class YaCAServerSaltyChatBridge {
  serverModule: YaCAServerModule;

  callMap: Map<string, number[]> = new Map();

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

  // eslint-disable-next-line
  saltyChatExport(method: string, cb: (...args: any[]) => void) {
    // eslint-disable-next-line
    on(`__cfx_export_saltychat_${method}`, (setCb: (...args: any[]) => void) =>
      setCb(cb),
    );
  }

  registerSaltyChatEvents() {
    this.saltyChatExport("GetPlayerAlive", (netId: number) => {
      this.serverModule.getPlayerAliveStatus(netId);
    });

    this.saltyChatExport(
      "SetPlayerAlive",
      (netId: number, isAlive: boolean) => {
        this.serverModule.changePlayerAliveStatus(netId, isAlive);
      },
    );

    this.saltyChatExport("GetPlayerVoiceRange", (netId: number) => {
      this.serverModule.getPlayerVoiceRange(netId);
    });

    this.saltyChatExport(
      "SetPlayerVoiceRange",
      (netId: number, voiceRange: number) => {
        this.serverModule.changeVoiceRange(netId, voiceRange);
      },
    );

    this.saltyChatExport(
      "AddPlayerToCall",
      (callIdentifier: string, playerHandle: number) =>
        this.addPlayerToCall(callIdentifier, playerHandle),
    );

    this.saltyChatExport(
      "AddPlayersToCall",
      (callIdentifier: string, playerHandles: number[]) =>
        this.addPlayerToCall(callIdentifier, playerHandles),
    );

    this.saltyChatExport(
      "RemovePlayerFromCall",
      (callIdentifier: string, playerHandle: number) =>
        this.removePlayerFromCall(callIdentifier, playerHandle),
    );

    this.saltyChatExport(
      "RemovePlayersFromCall",
      (callIdentifier: string, playerHandles: number[]) =>
        this.removePlayerFromCall(callIdentifier, playerHandles),
    );

    this.saltyChatExport(
      "SetPhoneSpeaker",
      (playerHandle: number, toggle: boolean) => {
        this.serverModule.phoneModule.enablePhoneSpeaker(playerHandle, toggle);
      },
    );

    this.saltyChatExport("SetPlayerRadioSpeaker", () => {
      console.warn("SetPlayerRadioSpeaker is not implemented in YaCA");
    });

    this.saltyChatExport(
      "GetPlayersInRadioChannel",
      (radioChannelName: string) =>
        this.serverModule.radioModule.getPlayersInRadioFrequency(
          radioChannelName,
        ),
    );

    this.saltyChatExport(
      "SetPlayerRadioChannel",
      (netId: number, radioChannelName: string, primary: boolean = true) => {
        const channel = primary ? 1 : 2;
        this.serverModule.radioModule.changeRadioFrequency(
          netId,
          channel,
          radioChannelName,
        );
      },
    );

    this.saltyChatExport(
      "RemovePlayerRadioChannel",
      (netId: number, primary: boolean) => {
        const channel = primary ? 1 : 2;
        this.serverModule.radioModule.changeRadioFrequency(netId, channel, "0");
      },
    );

    this.saltyChatExport("SetRadioTowers", () => {
      console.warn("SetRadioTowers is not implemented in YaCA");
    });
  }

  addPlayerToCall(callIdentifier: string, playerHandle: number | number[]) {
    if (!Array.isArray(playerHandle)) {
      playerHandle = [playerHandle];
    }

    if (!this.callMap.has(callIdentifier)) {
      this.callMap.set(callIdentifier, []);
    }

    const currentlyInCall = this.callMap.get(callIdentifier)!;

    if (currentlyInCall) {
      this.callMap.set(callIdentifier, currentlyInCall.concat(playerHandle));
    } else {
      this.callMap.set(callIdentifier, playerHandle);
    }

    const nowInCall = this.callMap.get(callIdentifier)!;

    for (const player of nowInCall) {
      for (const otherPlayer of nowInCall) {
        if (player !== otherPlayer && !currentlyInCall.includes(otherPlayer)) {
          this.serverModule.phoneModule.callPlayer(player, otherPlayer, true);
        }
      }
    }
  }

  removePlayerFromCall(
    callIdentifier: string,
    playerHandle: number | number[],
  ) {
    if (!Array.isArray(playerHandle)) {
      playerHandle = [playerHandle];
    }

    if (!this.callMap.has(callIdentifier)) {
      return;
    }

    const currentlyInCall = this.callMap.get(callIdentifier)!;

    this.callMap.set(
      callIdentifier,
      currentlyInCall.filter(
        (player) => !(playerHandle as number[]).includes(player),
      ),
    );

    const nowInCall = this.callMap.get(callIdentifier)!;

    for (const player of currentlyInCall) {
      for (const otherPlayer of currentlyInCall) {
        if (player !== otherPlayer && !nowInCall.includes(otherPlayer)) {
          this.serverModule.phoneModule.callPlayer(player, otherPlayer, false);
        }
      }
    }
  }
}
