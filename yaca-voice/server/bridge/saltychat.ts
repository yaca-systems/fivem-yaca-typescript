import { YaCAServerModule } from "../yaca";
import { cache } from "../utils";

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
      (netId: number, radioChannelName: string, primary = true) => {
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

    const beforeInCall = this.callMap.get(callIdentifier) ?? [],
      nowInCall = beforeInCall.concat(playerHandle);
    this.callMap.set(callIdentifier, nowInCall);

    for (const player of nowInCall) {
      for (const otherPlayer of nowInCall) {
        if (player !== otherPlayer && !beforeInCall.includes(otherPlayer)) {
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

    const beforeInCall = this.callMap.get(callIdentifier);
    if (!beforeInCall) {
      return;
    }

    const nowInCall = beforeInCall?.filter(
      (player) => !(playerHandle as number[]).includes(player),
    );
    this.callMap.set(callIdentifier, nowInCall);

    for (const player of beforeInCall) {
      for (const otherPlayer of beforeInCall) {
        if (player !== otherPlayer && !nowInCall.includes(otherPlayer)) {
          this.serverModule.phoneModule.callPlayer(player, otherPlayer, false);
        }
      }
    }
  }
}
