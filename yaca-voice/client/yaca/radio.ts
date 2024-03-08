import type { YaCAClientModule } from "yaca";
import {
  CommDeviceMode,
  YacaFilterEnum,
  YacaNotificationType,
  type YacaRadioSettings,
  YacaStereoMode,
} from "types";
import { cache, clamp, requestAnimDict } from "../utils";
import { locale } from "common/locale";

export class YaCAClientRadioModule {
  clientModule: YaCAClientModule;

  radioFrequencySet = false;
  radioEnabled = false;
  radioTalking = false;
  radioChannelSettings: { [key: number]: YacaRadioSettings } = {};
  radioInitialized = false;
  activeRadioChannel = 1;
  playersWithShortRange = new Map();
  playersInRadioChannel: Map<number, Set<number>> = new Map();

  defaultRadioSettings: YacaRadioSettings = {
    frequency: "0",
    muted: false,
    volume: 1,
    stereo: YacaStereoMode.STEREO,
  };

  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerExports();
    this.registerEvents();

    if (!this.clientModule.sharedConfig.saltyChatBridge) {
      this.registerKeybinds();
    }
  }

  registerExports() {
    /**
     * Enables or disables the radio system.
     *
     * @param {boolean} state - The state of the radio system.
     */
    exports("enableRadio", (state: boolean) => this.enableRadio(state));

    /**
     * Changes the radio frequency of the active channel.
     *
     * @param {string} frequency - The frequency to set.
     */
    exports("changeRadioFrequency", (frequency: string) =>
      this.changeRadioFrequency(frequency),
    );

    /**
     * Changes the radio frequency.
     *
     * @param {number} channel - The channel number.
     * @param {string} frequency - The frequency to set.
     */
    exports("changeRadioFrequencyRaw", (channel: number, frequency: string) =>
      this.changeRadioFrequencyRaw(channel, frequency),
    );

    /**
     * Mutes the active radio channel.
     */
    exports("muteRadioChannel", () => this.muteRadioChannel());

    /**
     * Exports the `muteRadioChannelRaw` function to the plugin.
     * This function mutes a radio channel.
     *
     * @param {number} channel - The channel number.
     */
    exports("muteRadioChannelRaw", (channel: number) =>
      this.muteRadioChannelRaw(channel),
    );

    /**
     * Exports the `changeActiveRadioChannel` function to the plugin.
     * This function changes the active radio channel.
     *
     * @param {number} channel - The new radio channel.
     */
    exports("changeActiveRadioChannel", (channel: number) =>
      this.changeActiveRadioChannel(channel),
    );

    /**
     * Exports the `getActiveRadioChannel` function to the plugin.
     * This function returns the active radio channel.
     *
     * @returns {number} The active radio channel.
     */
    exports("getActiveRadioChannel", () => this.activeRadioChannel);

    /**
     * Exports the `changeRadioChannelVolume` function to the plugin.
     * This function changes the volume of the active radio channel.
     *
     * @param {boolean} higher - Whether to increase the volume.
     */
    exports("changeRadioChannelVolume", (higher: boolean) =>
      this.changeRadioChannelVolume(higher),
    );

    /**
     * Exports the `changeRadioChannelVolumeRaw` function to the plugin.
     * This function changes the volume of a radio channel.
     *
     * @param {number} channel - The channel number.
     * @param {number} volume - The volume to set.
     */
    exports("changeRadioChannelVolumeRaw", (channel: number, volume: number) =>
      this.changeRadioChannelVolumeRaw(channel, volume),
    );

    /**
     * Exports the `changeRadioChannelStereo` function to the plugin.
     * This function changes the stereo mode for the active radio channel.
     */
    exports("changeRadioChannelStereo", () => this.changeRadioChannelStereo());

    /**
     * Exports the `changeRadioChannelStereoRaw` function to the plugin.
     * This function changes the stereo mode for a radio channel.
     *
     * @param {number} channel - The channel number.
     * @param {YacaStereoMode} stereo - The stereo mode to set.
     */
    exports(
      "changeRadioChannelStereoRaw",
      (channel: number, stereo: YacaStereoMode) =>
        this.changeRadioChannelStereoRaw(channel, stereo),
    );
  }

  registerEvents() {
    /**
     * Handles the "client:yaca:setRadioFreq" server event.
     *
     * @param {number} channel - The channel number.
     * @param {string} frequency - The frequency to set.
     */
    onNet("client:yaca:setRadioFreq", (channel: number, frequency: string) => {
      this.setRadioFrequency(channel, frequency);
    });

    /**
     * Handles the "client:yaca:radioTalking" server event.
     *
     * @param {number} target - The ID of the target.
     * @param {string} frequency - The frequency of the radio.
     * @param {boolean} state - The state of the radio talking.
     * @param {object[]} infos - The information about the radio.
     * @param {boolean} infos.shortRange - The state of the short range.
     * @param {boolean} self - The state of the player.
     */
    onNet(
      "client:yaca:radioTalking",
      (
        target: number,
        frequency: string,
        state: boolean,
        infos: { shortRange: boolean }[],
        self = false,
      ) => {
        if (self) {
          this.radioTalkingStateToPluginWithWhisper(state, target);
          return;
        }

        const channel = this.findRadioChannelByFrequency(frequency);
        if (!channel) {
          return;
        }

        const player = this.clientModule.getPlayerByID(target);
        if (!player) {
          return;
        }

        const info = infos[cache.serverId];

        if (
          !info?.shortRange /* TODO: || (info?.shortRange && alt.Player.getByRemoteID(target)?.isSpawned) */
        ) {
          this.clientModule.setPlayersCommType(
            player,
            YacaFilterEnum.RADIO,
            state,
            channel,
            undefined,
            CommDeviceMode.RECEIVER,
            CommDeviceMode.SENDER,
          );
        }

        state
          ? this.playersInRadioChannel.get(channel)?.add(target)
          : this.playersInRadioChannel.get(channel)?.delete(target);

        if (info?.shortRange || !state) {
          if (state) {
            this.playersWithShortRange.set(target, frequency);
          } else {
            this.playersWithShortRange.delete(target);
          }
        }
      },
    );

    /**
     * Handles the "client:yaca:setRadioMuteState" server event.
     *
     * @param {number} channel - The channel number.
     * @param {boolean} state - The state of the radio mute.
     */
    onNet(
      "client:yaca:setRadioMuteState",
      (channel: number, state: boolean) => {
        this.radioChannelSettings[channel].muted = state;
        emit("yaca:external:setRadioMuteState", channel, state);
        this.disableRadioFromPlayerInChannel(channel);
      },
    );

    /**
     * Handles the "client:yaca:leaveRadioChannel" server event.
     *
     * @param {number | number[]} client_ids - The IDs of the clients.
     * @param {string} frequency - The frequency of the radio.
     */
    onNet(
      "client:yaca:leaveRadioChannel",
      (client_ids: number | number[], frequency: string) => {
        if (!Array.isArray(client_ids)) {
          client_ids = [client_ids];
        }

        const channel = this.findRadioChannelByFrequency(frequency);
        if (!channel) {
          return;
        }

        const playerData = this.clientModule.getPlayerByID(cache.serverId);
        if (!playerData || !playerData.clientId) {
          return;
        }

        if (client_ids.includes(playerData.clientId)) {
          this.setRadioFrequency(channel, "0");
        }

        this.clientModule.sendWebsocket({
          base: { request_type: "INGAME" },
          comm_device_left: {
            comm_type: YacaFilterEnum.RADIO,
            client_ids,
            channel,
          },
        });
      },
    );
  }

  registerKeybinds() {
    /**
     * Registers the command and key mapping for the radio talking.
     */
    RegisterCommand(
      "+yaca:radioTalking",
      () => {
        this.radioTalkingStart(true);
      },
      false,
    );
    RegisterCommand(
      "-yaca:radioTalking",
      () => {
        this.radioTalkingStart(false);
      },
      false,
    );
    RegisterKeyMapping(
      "+yaca:radioTalking",
      locale("use_radio"),
      "keyboard",
      this.clientModule.sharedConfig.keyBinds.radioTransmit,
    );
  }

  /**
   * Enable or disable the radio system.
   *
   * @param {boolean} state - The state of the radio system.
   */
  enableRadio(state: boolean) {
    if (!this.clientModule.isPluginInitialized()) {
      return;
    }

    if (this.radioEnabled !== state) {
      this.radioEnabled = state;
      emitNet("server:yaca:enableRadio", state);

      if (!state) {
        for (
          let i = 1;
          i <= this.clientModule.sharedConfig.maxRadioChannels;
          i++
        ) {
          this.disableRadioFromPlayerInChannel(i);
        }
      }

      emit("yaca:external:isRadioEnabled", state);

      if (state && !this.radioInitialized) {
        this.radioInitialized = true;
        this.initRadioSettings();
      }
    }
  }

  /**
   * Change the radio frequency ot the current active channel.
   *
   * @param {string} frequency - The new frequency.
   */
  changeRadioFrequency(frequency: string) {
    if (!this.clientModule.isPluginInitialized()) {
      return;
    }

    emitNet(
      "server:yaca:changeRadioFrequency",
      this.activeRadioChannel,
      frequency,
    );
  }

  /**
   * Change the radio frequency.
   *
   * @param {number} channel - The channel number.
   * @param {string} frequency - The frequency to set.
   */
  changeRadioFrequencyRaw(channel: number, frequency: string) {
    if (!this.clientModule.isPluginInitialized()) {
      return;
    }

    emitNet("server:yaca:changeRadioFrequency", channel, frequency);
  }

  /**
   * Mute the active radio channel.
   */
  muteRadioChannel() {
    this.muteRadioChannelRaw(this.activeRadioChannel);
  }

  /**
   * Mute a radio channel.
   *
   * @param {number} channel - The channel to mute.
   */
  muteRadioChannelRaw(channel: number) {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    if (this.radioChannelSettings[channel].frequency === "0") {
      return;
    }
    emitNet("server:yaca:muteRadioChannel", channel);
  }

  /**
   * Change the active radio channel.
   *
   * @param {number} channel - The new radio channel.
   */
  changeActiveRadioChannel(channel: number) {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    emitNet("server:yaca:changeActiveRadioChannel", channel);
    emit("yaca:external:changedActiveRadioChannel", channel);
    this.activeRadioChannel = channel;
  }

  /**
   * Change the volume of the active radio channel.
   *
   * @param {boolean} higher - Whether to increase the volume.
   */
  changeRadioChannelVolume(higher: boolean) {
    const channel = this.activeRadioChannel,
      oldVolume = this.radioChannelSettings[channel].volume;
    this.changeRadioChannelVolumeRaw(
      channel,
      oldVolume + (higher ? 0.17 : -0.17),
    );
  }

  /**
   * Change the volume of a radio channel.
   *
   * @param {number} channel - The channel number.
   * @param {number} volume - The volume to set.
   */
  changeRadioChannelVolumeRaw(channel: number, volume: number) {
    if (
      !this.clientModule.isPluginInitialized() ||
      !this.radioEnabled ||
      this.radioChannelSettings[channel].frequency === "0"
    ) {
      return;
    }

    const oldVolume = this.radioChannelSettings[channel].volume;
    this.radioChannelSettings[channel].volume = clamp(volume, 0, 1);

    // Prevent event emit spams, if nothing changed
    if (oldVolume === this.radioChannelSettings[channel].volume) {
      return;
    }

    if (
      this.radioChannelSettings[channel].volume === 0 ||
      (oldVolume === 0 && this.radioChannelSettings[channel].volume > 0)
    ) {
      emitNet("server:yaca:muteRadioChannel", channel);
    }

    // Prevent duplicate update, cuz mute has its own update
    if (this.radioChannelSettings[channel].volume > 0) {
      emit(
        "yaca:external:setRadioVolume",
        channel,
        this.radioChannelSettings[channel].volume,
      );
    }

    // Send update to voice plugin
    this.clientModule.setCommDeviceVolume(
      YacaFilterEnum.RADIO,
      this.radioChannelSettings[channel].volume,
      channel,
    );
  }

  /**
   * Change the stereo mode for the active radio channel.
   */
  changeRadioChannelStereo() {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    const channel = this.activeRadioChannel;

    switch (this.radioChannelSettings[channel].stereo) {
      case YacaStereoMode.STEREO:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.MONO_LEFT);
        emit(
          "yaca:external:setRadioChannelStereo",
          channel,
          YacaStereoMode.MONO_LEFT,
        );
        this.clientModule.notification(
          locale("changed_stereo_mode", channel, locale("left_ear")),
          YacaNotificationType.INFO,
        );
        return;
      case YacaStereoMode.MONO_LEFT:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.MONO_RIGHT);
        emit(
          "yaca:external:setRadioChannelStereo",
          channel,
          YacaStereoMode.MONO_RIGHT,
        );
        this.clientModule.notification(
          locale("changed_stereo_mode", channel, locale("right_ear")),
          YacaNotificationType.INFO,
        );
        return;
      default:
      case YacaStereoMode.MONO_RIGHT:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.STEREO);
        emit(
          "yaca:external:setRadioChannelStereo",
          channel,
          YacaStereoMode.STEREO,
        );
        this.clientModule.notification(
          locale("changed_stereo_mode", channel, locale("both_ears")),
          YacaNotificationType.INFO,
        );
        return;
    }
  }

  /**
   * Change the stereo mode for a radio channel.
   *
   * @param channel - The channel number.
   * @param stereo - The stereo mode to set.
   */
  changeRadioChannelStereoRaw(channel: number, stereo: YacaStereoMode) {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    this.radioChannelSettings[channel].stereo = stereo;

    this.clientModule.setCommDeviceStereomode(
      YacaFilterEnum.RADIO,
      stereo,
      channel,
    );
  }

  /**
   * Set volume & stereo mode for all radio channels on first start and reconnect.
   */
  initRadioSettings() {
    for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
      if (!this.radioChannelSettings[i]) {
        this.radioChannelSettings[i] = {
          ...this.defaultRadioSettings,
        };
      }
      if (!this.playersInRadioChannel.has(i)) {
        this.playersInRadioChannel.set(i, new Set());
      }

      const { volume } = this.radioChannelSettings[i],
        { stereo } = this.radioChannelSettings[i];

      this.clientModule.setCommDeviceStereomode(
        YacaFilterEnum.RADIO,
        stereo,
        i,
      );
      this.clientModule.setCommDeviceVolume(YacaFilterEnum.RADIO, volume, i);
    }
  }

  /**
   * Sends an event to the plugin when a player starts or stops talking on the radio.
   *
   * @param {boolean} state - The state of the player talking on the radio.
   */
  radioTalkingStateToPlugin(state: boolean) {
    this.clientModule.setPlayersCommType(
      this.clientModule.getPlayerByID(cache.serverId),
      YacaFilterEnum.RADIO,
      state,
      this.activeRadioChannel,
    );
  }

  /**
   * Sends an event to the plugin when a player starts or stops talking on the radio with whisper.
   *
   * @param state - The state of the player talking on the radio.
   * @param targets - The IDs of the targets.
   */
  radioTalkingStateToPluginWithWhisper(
    state: boolean,
    targets: number | number[],
  ) {
    if (!Array.isArray(targets)) {
      targets = [targets];
    }

    const comDeviceTargets = [];
    for (const target of targets) {
      const player = this.clientModule.getPlayerByID(target);
      if (!player) {
        continue;
      }

      comDeviceTargets.push(player);
    }

    this.clientModule.setPlayersCommType(
      comDeviceTargets,
      YacaFilterEnum.RADIO,
      state,
      this.activeRadioChannel,
      undefined,
      CommDeviceMode.SENDER,
      CommDeviceMode.RECEIVER,
    );
  }

  /**
   * Finds a radio channel by a given frequency.
   *
   * @param {string} frequency - The frequency to search for.
   * @returns {number | undefined} The channel number if found, undefined otherwise.
   */
  findRadioChannelByFrequency(frequency: string): number | undefined {
    let foundChannel;
    for (const [channel, data] of Object.entries(this.radioChannelSettings)) {
      if (data.frequency === frequency) {
        foundChannel = parseInt(channel);
        break;
      }
    }

    return foundChannel;
  }

  /**
   * Set the radio frequency.
   *
   * @param channel - The channel number.
   * @param frequency - The frequency to set.
   */
  setRadioFrequency(channel: number, frequency: string) {
    this.radioFrequencySet = true;

    if (this.radioChannelSettings[channel].frequency !== frequency) {
      this.disableRadioFromPlayerInChannel(channel);
    }

    this.radioChannelSettings[channel].frequency = frequency;
    emit("yaca:external:setRadioFrequency", channel, frequency);

    // SaltyChat bridge
    if (this.clientModule.sharedConfig.saltyChatBridge) {
      const { frequency } = this.radioChannelSettings[channel];
      const saltyFrequency = frequency === "0" ? null : frequency;
      emit("SaltyChat_RadioChannelChanged", saltyFrequency, channel === 1);
    }
  }

  /**
   * Disable radio effect for all players in the given channel.
   *
   * @param {number} channel - The channel number.
   */
  disableRadioFromPlayerInChannel(channel: number) {
    if (!this.playersInRadioChannel.has(channel)) {
      return;
    }

    const players = this.playersInRadioChannel.get(channel);
    if (!players?.size) {
      return;
    }

    const targets = [];
    for (const playerId of players) {
      const player = this.clientModule.getPlayerByID(playerId);
      if (!player || !player.remoteID) {
        continue;
      }

      targets.push(player);
      players.delete(player.remoteID);
    }

    if (targets.length) {
      this.clientModule.setPlayersCommType(
        targets,
        YacaFilterEnum.RADIO,
        false,
        channel,
        undefined,
        CommDeviceMode.RECEIVER,
        CommDeviceMode.SENDER,
      );
    }
  }

  /**
   * Starts the radio talking state.
   *
   * @param {boolean} state - The state of the radio talking.
   * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
   */
  radioTalkingStart(state: boolean, clearPedTasks = true) {
    if (!state) {
      if (this.radioTalking) {
        this.radioTalking = false;
        if (!this.clientModule.useWhisper) {
          this.radioTalkingStateToPlugin(false);
        }

        emitNet("server:yaca:radioTalking", false);
        emit("yaca:external:isRadioTalking", false);

        if (clearPedTasks) {
          StopAnimTask(cache.ped, "random@arrests", "generic_radio_chatter", 4);
        }
      }

      return;
    }

    if (!this.radioEnabled || !this.radioFrequencySet || this.radioTalking) {
      return;
    }

    this.radioTalking = true;
    if (!this.clientModule.useWhisper) {
      this.radioTalkingStateToPlugin(true);
    }

    requestAnimDict("random@arrests").then(() => {
      TaskPlayAnim(
        cache.ped,
        "random@arrests",
        "generic_radio_chatter",
        3,
        -4,
        -1,
        49,
        0.0,
        false,
        false,
        false,
      );

      emitNet("server:yaca:radioTalking", true);
      emit("yaca:external:isRadioTalking", true);
    });
  }
}
