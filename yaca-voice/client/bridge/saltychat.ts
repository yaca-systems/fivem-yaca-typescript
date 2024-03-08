import type { YaCAClientModule } from "../yaca";
import { YacaResponseCode } from "types";
import { cache } from "../utils";
import { sleep } from "common/index";
import { locale } from "common/locale";

export class YaCAClientSaltyChatBridge {
  private clientModule: YaCAClientModule;

  private prevPluginState: YacaResponseCode | null = null;

  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerSaltyChatKeyBinds();
    this.registerSaltyChatExports();
    this.enableRadio();

    console.log("[YaCA] SaltyChat bridge loaded");

    on("onResourceStop", (resourceName: string) => {
      if (cache.resource !== resourceName) {
        return;
      }

      emit("onClientResourceStop", "saltychat");
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saltyChatExport(method: string, cb: (...args: any[]) => void) {
    on(
      `__cfx_export_saltychat_${method}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (setCb: (...args: any[]) => void) => {
        setCb(cb);
      },
    );
  }

  async enableRadio() {
    while (!this.clientModule.isPluginInitialized(true)) {
      await sleep(1000);
    }

    this.clientModule.radioModule.enableRadio(true);
  }

  registerSaltyChatKeyBinds() {
    RegisterCommand(
      "+primaryRadio",
      () => {
        this.clientModule.radioModule.changeActiveRadioChannel(1);
        this.clientModule.radioModule.radioTalkingStart(true);
      },
      false,
    );
    RegisterCommand(
      "-primaryRadio",
      () => {
        this.clientModule.radioModule.radioTalkingStart(false);
      },
      false,
    );
    RegisterKeyMapping(
      "+primaryRadio",
      locale("use_salty_primary_radio"),
      "keyboard",
      this.clientModule.sharedConfig.saltyChatBridge.keyBinds.primaryRadio,
    );

    RegisterCommand(
      "+secondaryRadio",
      () => {
        this.clientModule.radioModule.changeActiveRadioChannel(2);
        this.clientModule.radioModule.radioTalkingStart(true);
      },
      false,
    );
    RegisterCommand(
      "-secondaryRadio",
      () => {
        this.clientModule.radioModule.radioTalkingStart(false);
      },
      false,
    );
    RegisterKeyMapping(
      "+secondaryRadio",
      locale("use_salty_secondary_radio"),
      "keyboard",
      this.clientModule.sharedConfig.saltyChatBridge.keyBinds.secondaryRadio,
    );
  }

  registerSaltyChatExports() {
    this.saltyChatExport("y", () => this.clientModule.getVoiceRange());

    this.saltyChatExport("GetRadioChannel", (primary: boolean) => {
      const channel = primary ? 1 : 2;
      return this.clientModule.radioModule.radioChannelSettings[channel]
        .frequency;
    });

    this.saltyChatExport(
      "GetRadioVolume",
      () => this.clientModule.radioModule.radioChannelSettings[1].volume,
    );

    this.saltyChatExport("GetRadioSpeaker", () => {
      console.warn("GetRadioSpeaker is not implemented in YaCA");
      return false;
    });

    this.saltyChatExport("GetMicClick", () => {
      console.warn("GetMicClick is not implemented in YaCA");
      return false;
    });

    this.saltyChatExport(
      "SetRadioChannel",
      (radioChannelName: string, primary: boolean) => {
        const channel = primary ? 1 : 2;
        this.clientModule.radioModule.changeRadioFrequencyRaw(
          channel,
          radioChannelName,
        );
      },
    );

    this.saltyChatExport("SetRadioVolume", (volume: number) => {
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(1, volume);
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(2, volume);
    });

    this.saltyChatExport("SetRadioSpeaker", () => {
      console.warn("SetRadioSpeaker is not implemented in YaCA");
    });

    this.saltyChatExport("SetMicClick", () => {
      console.warn("SetMicClick is not implemented in YaCA");
    });
  }

  handleChangePluginState(response: YacaResponseCode) {
    if (this.prevPluginState === response) {
      return;
    }
    let state = 0;

    switch (response) {
      case "OK":
        state = 2;
        break;
      case "MOVE_ERROR":
      case "OUTDATED_VERSION":
      case "WAIT_GAME_INIT":
        state = 1;
        break;
      case "WRONG_TS_SERVER":
      case "NOT_CONNECTED":
        state = 0;
        break;
      default:
        return;
    }

    this.prevPluginState = response;
    emit("SaltyChat_PluginStateChanged", state);
  }

  handleDisconnectState() {
    this.prevPluginState = null;
    emit("SaltyChat_PluginStateChanged", -1);
  }
}
