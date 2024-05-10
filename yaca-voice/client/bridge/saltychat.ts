import type { YaCAClientModule } from "../yaca";
import { YacaResponseCode } from "types";
import { cache, registerRdrKeyBind } from "../utils";
import { sleep } from "common/index";
import { locale } from "common/locale";
import { saltyChatExport } from "common/bridge";

/**
 * The SaltyChat bridge for the client.
 */
export class YaCAClientSaltyChatBridge {
  private clientModule: YaCAClientModule;

  private prevPluginState: YacaResponseCode | null = null;

  private isPrimarySending = false;
  private isSecondarySending = false;

  private isPrimaryReceiving = false;
  private isSecondaryReceiving = false;

  /**
   * Creates an instance of the SaltyChat bridge.
   *
   * @param {YaCAClientModule} clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    if (this.clientModule.isFiveM) {
      this.registerSaltyChatKeyBinds();
    } else if (this.clientModule.isRedM) {
      this.registerSaltyChatRdrKeyBinds();
    }
    this.registerSaltyChatExports();
    this.enableRadio().then();

    console.log("[YaCA] SaltyChat bridge loaded");

    on("onResourceStop", (resourceName: string) => {
      if (cache.resource !== resourceName) {
        return;
      }

      emit("onClientResourceStop", "saltychat");
    });
  }

  /**
   * Enables the radio on bridge load.
   */
  async enableRadio() {
    while (!this.clientModule.isPluginInitialized(true)) {
      await sleep(1000);
    }

    this.clientModule.radioModule.enableRadio(true);
  }

  /**
   * Register SaltyChat key binds.
   */
  registerSaltyChatKeyBinds() {
    if (this.clientModule.sharedConfig.saltyChatBridge.keyBinds.primaryRadio !== false) {
      RegisterCommand(
        "+primaryRadio",
        () => {
          this.clientModule.radioModule.radioTalkingStart(true, 1);
        },
        false,
      );
      RegisterCommand(
        "-primaryRadio",
        () => {
          this.clientModule.radioModule.radioTalkingStart(false, 1);
        },
        false,
      );
      RegisterKeyMapping("+primaryRadio", locale("use_salty_primary_radio"), "keyboard", this.clientModule.sharedConfig.saltyChatBridge.keyBinds.primaryRadio);
    }

    if (this.clientModule.sharedConfig.saltyChatBridge.keyBinds.secondaryRadio !== false) {
      RegisterCommand(
        "+secondaryRadio",
        () => {
          this.clientModule.radioModule.radioTalkingStart(true, 2);
        },
        false,
      );
      RegisterCommand(
        "-secondaryRadio",
        () => {
          this.clientModule.radioModule.radioTalkingStart(false, 2);
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
  }

  registerSaltyChatRdrKeyBinds() {
    if (this.clientModule.sharedConfig.saltyChatBridge.keyBinds.primaryRadio !== false) {
      registerRdrKeyBind(
        this.clientModule.sharedConfig.saltyChatBridge.keyBinds.primaryRadio,
        () => {
          this.clientModule.radioModule.radioTalkingStart(true, 1);
        },
        () => {
          this.clientModule.radioModule.radioTalkingStart(false, 1);
        },
      );
    }

    if (this.clientModule.sharedConfig.saltyChatBridge.keyBinds.secondaryRadio !== false) {
      registerRdrKeyBind(
        this.clientModule.sharedConfig.saltyChatBridge.keyBinds.secondaryRadio,
        () => {
          this.clientModule.radioModule.radioTalkingStart(true, 2);
        },
        () => {
          this.clientModule.radioModule.radioTalkingStart(false, 2);
        },
      );
    }
  }

  /**
   * Register SaltyChat exports.
   */
  registerSaltyChatExports() {
    saltyChatExport("GetVoiceRange", () => this.clientModule.getVoiceRange());

    saltyChatExport("GetRadioChannel", (primary: boolean) => {
      const channel = primary ? 1 : 2;

      const currentFrequency = this.clientModule.radioModule.radioChannelSettings[channel].frequency;

      if (currentFrequency === "0") {
        return "";
      }

      return currentFrequency;
    });

    saltyChatExport("GetRadioVolume", () => {
      return this.clientModule.radioModule.radioChannelSettings[1].volume;
    });

    saltyChatExport("GetRadioSpeaker", () => {
      console.warn("GetRadioSpeaker is not implemented in YaCA");
      return false;
    });

    saltyChatExport("GetMicClick", () => {
      console.warn("GetMicClick is not implemented in YaCA");
      return false;
    });

    saltyChatExport("SetRadioChannel", (radioChannelName: string, primary: boolean) => {
      const channel = primary ? 1 : 2;
      const newRadioChannelName = radioChannelName === "" ? "0" : radioChannelName;

      this.clientModule.radioModule.changeRadioFrequencyRaw(channel, newRadioChannelName);
    });

    saltyChatExport("SetRadioVolume", (volume: number) => {
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(1, volume);
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(2, volume);
    });

    saltyChatExport("SetRadioSpeaker", () => {
      console.warn("SetRadioSpeaker is not implemented in YaCA");
    });

    saltyChatExport("SetMicClick", () => {
      console.warn("SetMicClick is not implemented in YaCA");
    });
  }

  /**
   * Handles the plugin state change.
   *
   * @param response - The last response code.
   */
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

  /**
   * Handles the websocket disconnect.
   */
  handleDisconnectState() {
    this.prevPluginState = null;
    emit("SaltyChat_PluginStateChanged", -1);
  }

  /**
   * Sends the radio talking state.
   */
  sendRadioTalkingState() {
    emit("SaltyChat_RadioTrafficStateChanged", this.isPrimaryReceiving, this.isPrimarySending, this.isSecondaryReceiving, this.isSecondarySending);
  }

  /**
   * Handle radio talking state change.
   *
   * @param state - The state of the radio talking.
   * @param channel - The radio channel.
   */
  handleRadioTalkingStateChange(state: boolean, channel: number) {
    if (channel === 1) {
      this.isPrimarySending = state;
    } else {
      this.isSecondarySending = state;
    }

    this.sendRadioTalkingState();
  }

  /**
   * Handle radio receiving state change.
   *
   * @param state - The state of the radio receiving.
   * @param channel - The radio channel.
   */
  handleRadioReceivingStateChange(state: boolean, channel: number) {
    if (channel === 1) {
      this.isPrimaryReceiving = state;
    } else {
      this.isSecondaryReceiving = state;
    }

    this.sendRadioTalkingState();
  }
}
