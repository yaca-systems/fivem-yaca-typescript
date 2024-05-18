import type { YaCAClientModule } from "yaca";
import { CommDeviceMode, YacaFilterEnum, YacaNotificationType, type YacaPlayerData, type YacaRadioSettings, YacaStereoMode } from "types";
import { cache, clamp, registerRdrKeyBind, requestAnimDict } from "../utils";
import { locale } from "common/locale";

/**
 * The radio module for the client.
 */
export class YaCAClientRadioModule {
  clientModule: YaCAClientModule;

  radioEnabled = false;
  talkingInChannels = new Set<number>();
  radioChannelSettings = new Map<number, YacaRadioSettings>();
  radioInitialized = false;
  activeRadioChannel = 1;
  playersWithShortRange = new Map<number, string>();
  playersInRadioChannel = new Map<number, Set<number>>();

  defaultRadioSettings: YacaRadioSettings = {
    frequency: "0",
    muted: false,
    volume: 1,
    stereo: YacaStereoMode.STEREO,
  };

  /**
   * Creates an instance of the radio module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerExports();
    this.registerEvents();

    if (!this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
      if (this.clientModule.isFiveM) {
        this.registerKeybinds();
      } else {
        this.registerRdrKeybinds();
      }
    }
  }

  /**
   * Registers the exports for the radio module.
   */
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
    exports("changeRadioFrequency", (frequency: string) => this.changeRadioFrequency(frequency));

    /**
     * Changes the radio frequency.
     *
     * @param {number} channel - The channel number.
     * @param {string} frequency - The frequency to set.
     */
    exports("changeRadioFrequencyRaw", (channel: number, frequency: string) => this.changeRadioFrequencyRaw(channel, frequency));

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
    exports("muteRadioChannelRaw", (channel: number) => this.muteRadioChannelRaw(channel));

    /**
     * Exports the `changeActiveRadioChannel` function to the plugin.
     * This function changes the active radio channel.
     *
     * @param {number} channel - The new radio channel.
     */
    exports("changeActiveRadioChannel", (channel: number) => this.changeActiveRadioChannel(channel));

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
    exports("changeRadioChannelVolume", (higher: boolean) => this.changeRadioChannelVolume(higher));

    /**
     * Exports the `changeRadioChannelVolumeRaw` function to the plugin.
     * This function changes the volume of a radio channel.
     *
     * @param {number} channel - The channel number.
     * @param {number} volume - The volume to set.
     */
    exports("changeRadioChannelVolumeRaw", (channel: number, volume: number) => this.changeRadioChannelVolumeRaw(channel, volume));

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
    exports("changeRadioChannelStereoRaw", (channel: number, stereo: YacaStereoMode) => this.changeRadioChannelStereoRaw(channel, stereo));

    /**
     * Exports the `radioTalkingStart` function to the plugin.
     * This function starts the radio talking state.
     *
     * @param {boolean} state - The state of the radio talking.
     * @param {number} channel - The radio channel.
     * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
     */
    exports("radioTalkingStart", (state: boolean, channel: number, clearPedTasks = true) => this.radioTalkingStart(state, channel, clearPedTasks));
  }

  /**
   * Registers the events for the radio module.
   */
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
    onNet("client:yaca:radioTalking", (target: number, frequency: string, state: boolean, infos: { shortRange: boolean }[], self = false) => {
      const channel = this.findRadioChannelByFrequency(frequency);
      if (!channel) {
        return;
      }

      if (self) {
        this.radioTalkingStateToPluginWithWhisper(state, target, channel);
        return;
      }

      const player = this.clientModule.getPlayerByID(target);
      if (!player) {
        return;
      }

      const info = infos[cache.serverId];

      if (!info?.shortRange || (info?.shortRange && GetPlayerFromServerId(target) !== -1)) {
        this.clientModule.setPlayersCommType(player, YacaFilterEnum.RADIO, state, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);
      }

      if (state) {
        this.playersInRadioChannel.get(channel)?.add(target);
        if (info?.shortRange) {
          this.playersWithShortRange.set(target, frequency);
        }

        emit("yaca:external:isRadioReceiving", true, channel);

        if (this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
          this.clientModule.saltyChatBridge?.handleRadioReceivingStateChange(true, channel);
        }
      } else {
        this.playersInRadioChannel.get(channel)?.delete(target);
        if (info?.shortRange) {
          this.playersWithShortRange.delete(target);
        }

        const inRadio = this.playersInRadioChannel.get(channel)?.size || 0;
        const state = inRadio > 0;
        emit("yaca:external:isRadioReceiving", state, channel);

        if (this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
          this.clientModule.saltyChatBridge?.handleRadioReceivingStateChange(state, channel);
        }
      }
    });

    /**
     * Handles the "client:yaca:setRadioMuteState" server event.
     *
     * @param {number} channel - The channel number.
     * @param {boolean} state - The state of the radio mute.
     */
    onNet("client:yaca:setRadioMuteState", (channel: number, state: boolean) => {
      const channelSettings = this.radioChannelSettings.get(channel);

      if (!channelSettings) {
        return;
      }

      channelSettings.muted = state;
      emit("yaca:external:setRadioMuteState", channel, state);
      this.disableRadioFromPlayerInChannel(channel);
    });

    /**
     * Handles the "client:yaca:leaveRadioChannel" server event.
     *
     * @param {number | number[]} client_ids - The IDs of the clients.
     * @param {string} frequency - The frequency of the radio.
     */
    onNet("client:yaca:leaveRadioChannel", (client_ids: number | number[], frequency: string) => {
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
    });
  }

  /**
   * Registers the command and key mapping for the radio talking.
   */
  registerKeybinds() {
    if (this.clientModule.sharedConfig.keyBinds.radioTransmit === false) {
      return;
    }

    /**
     * Registers the command and key mapping for the radio talking.
     */
    RegisterCommand(
      "+yaca:radioTalking",
      () => {
        this.radioTalkingStart(true, this.activeRadioChannel);
      },
      false,
    );
    RegisterCommand(
      "-yaca:radioTalking",
      () => {
        this.radioTalkingStart(false, this.activeRadioChannel);
      },
      false,
    );
    RegisterKeyMapping("+yaca:radioTalking", locale("use_radio"), "keyboard", this.clientModule.sharedConfig.keyBinds.radioTransmit);
  }

  /**
   * Registers the keybindings for the radio talking.
   * This is only available in RedM.
   */
  registerRdrKeybinds() {
    if (this.clientModule.sharedConfig.keyBinds.radioTransmit === false) {
      return;
    }

    registerRdrKeyBind(
      this.clientModule.sharedConfig.keyBinds.radioTransmit,
      () => {
        this.radioTalkingStart(true, this.activeRadioChannel);
      },
      () => {
        this.radioTalkingStart(false, this.activeRadioChannel);
      },
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
        for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
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
    this.changeRadioFrequencyRaw(this.activeRadioChannel, frequency);
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

    const channelSettings = this.radioChannelSettings.get(channel);

    if (!channelSettings) {
      return;
    }

    if (channelSettings.frequency === "0") {
      return;
    }

    emitNet("server:yaca:muteRadioChannel", channel);
  }

  /**
   * Check if a radio channel is muted.
   *
   * @param channel - The channel number. Defaults to the active channel.
   * @returns {boolean} Whether the channel is muted. If the channel does not exist, it will return true.
   */
  isRadioChannelMuted(channel: number = this.activeRadioChannel): boolean {
    const channelData = this.radioChannelSettings.get(channel);

    if (!channelData) {
      return true;
    }

    return channelData.muted;
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
    const channel = this.activeRadioChannel;
    const radioSettings = this.radioChannelSettings.get(channel);

    if (!radioSettings) {
      return false;
    }

    const oldVolume = radioSettings.volume;
    this.changeRadioChannelVolumeRaw(channel, oldVolume + (higher ? 0.17 : -0.17));
  }

  /**
   * Change the volume of a radio channel.
   *
   * @param {number} channel - The channel number.
   * @param {number} volume - The volume to set.
   */
  changeRadioChannelVolumeRaw(channel: number, volume: number) {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    const channelSettings = this.radioChannelSettings.get(channel);
    if (!channelSettings) {
      return;
    }

    const oldVolume = channelSettings.volume;
    channelSettings.volume = clamp(volume, 0, 1);

    // Prevent event emit spams, if nothing changed
    if (oldVolume === channelSettings.volume) {
      return;
    }

    if (channelSettings.volume === 0 || (oldVolume === 0 && channelSettings.volume > 0)) {
      emitNet("server:yaca:muteRadioChannel", channel);
    }

    // Prevent duplicate update, cuz mute has its own update
    if (channelSettings.volume > 0) {
      emit("yaca:external:setRadioVolume", channel, channelSettings.volume);
    }

    // Send update to voice plugin
    this.clientModule.setCommDeviceVolume(YacaFilterEnum.RADIO, channelSettings.volume, channel);
  }

  /**
   * Change the stereo mode for the active radio channel.
   */
  changeRadioChannelStereo() {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
      return;
    }

    const channel = this.activeRadioChannel;
    const channelSettings = this.radioChannelSettings.get(channel);

    if (!channelSettings) {
      return;
    }

    switch (channelSettings.stereo) {
      case YacaStereoMode.STEREO:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.MONO_LEFT);
        emit("yaca:external:setRadioChannelStereo", channel, YacaStereoMode.MONO_LEFT);
        this.clientModule.notification(locale("changed_stereo_mode", channel, locale("left_ear")), YacaNotificationType.INFO);
        return;
      case YacaStereoMode.MONO_LEFT:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.MONO_RIGHT);
        emit("yaca:external:setRadioChannelStereo", channel, YacaStereoMode.MONO_RIGHT);
        this.clientModule.notification(locale("changed_stereo_mode", channel, locale("right_ear")), YacaNotificationType.INFO);
        return;
      default:
      case YacaStereoMode.MONO_RIGHT:
        this.changeRadioChannelStereoRaw(channel, YacaStereoMode.STEREO);
        emit("yaca:external:setRadioChannelStereo", channel, YacaStereoMode.STEREO);
        this.clientModule.notification(locale("changed_stereo_mode", channel, locale("both_ears")), YacaNotificationType.INFO);
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

    const channelSettings = this.radioChannelSettings.get(channel);
    if (!channelSettings) {
      return;
    }

    channelSettings.stereo = stereo;
    this.clientModule.setCommDeviceStereoMode(YacaFilterEnum.RADIO, stereo, channel);
  }

  /**
   * Set volume & stereo mode for all radio channels on first start and reconnect.
   */
  initRadioSettings() {
    for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
      if (!this.radioChannelSettings.has(i)) {
        this.radioChannelSettings.set(i, {
          ...this.defaultRadioSettings,
        });
      }
      if (!this.playersInRadioChannel.has(i)) {
        this.playersInRadioChannel.set(i, new Set());
      }

      const { volume, stereo } = this.radioChannelSettings.get(i) ?? this.defaultRadioSettings;

      this.clientModule.setCommDeviceStereoMode(YacaFilterEnum.RADIO, stereo, i);
      this.clientModule.setCommDeviceVolume(YacaFilterEnum.RADIO, volume, i);
    }
  }

  /**
   * Sends an event to the plugin when a player starts or stops talking on the radio.
   *
   * @param {boolean} state - The state of the player talking on the radio.
   * @param {number} channel - The channel number.
   */
  radioTalkingStateToPlugin(state: boolean, channel: number) {
    this.clientModule.setPlayersCommType(this.clientModule.getPlayerByID(cache.serverId), YacaFilterEnum.RADIO, state, channel);
  }

  /**
   * Sends an event to the plugin when a player starts or stops talking on the radio with whisper.
   *
   * @param state - The state of the player talking on the radio.
   * @param targets - The IDs of the targets.
   * @param channel - The channel number.
   */
  radioTalkingStateToPluginWithWhisper(state: boolean, targets: number | number[], channel: number) {
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

    this.clientModule.setPlayersCommType(comDeviceTargets, YacaFilterEnum.RADIO, state, channel, undefined, CommDeviceMode.SENDER, CommDeviceMode.RECEIVER);
  }

  /**
   * Finds a radio channel by a given frequency.
   *
   * @param {string} frequency - The frequency to search for.
   * @returns {number | null} The channel number if found, null otherwise.
   */
  findRadioChannelByFrequency(frequency: string): number | null {
    for (const [channel, data] of this.radioChannelSettings) {
      if (data.frequency === frequency) {
        return channel;
      }
    }

    return null;
  }

  /**
   * Set the radio frequency.
   *
   * @param channel - The channel number.
   * @param frequency - The frequency to set.
   */
  setRadioFrequency(channel: number, frequency: string) {
    const channelSettings = this.radioChannelSettings.get(channel);
    if (!channelSettings) {
      return false;
    }

    if (channelSettings.frequency !== frequency) {
      this.disableRadioFromPlayerInChannel(channel);
    }

    channelSettings.frequency = frequency;
    emit("yaca:external:setRadioFrequency", channel, frequency);

    // SaltyChat bridge
    if (this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
      const saltyFrequency = channelSettings.frequency === "0" ? "" : channelSettings.frequency;
      emit("SaltyChat_RadioChannelChanged", saltyFrequency, channel === 1);
    }
  }

  /**
   * Disable radio effect for all players in the given channel.
   *
   * @param {number} channel - The channel number.
   */
  disableRadioFromPlayerInChannel(channel: number) {
    const players = this.playersInRadioChannel.get(channel);
    if (!players || !players.size) {
      return;
    }

    const targets: YacaPlayerData[] = [];
    for (const playerId of players) {
      const player = this.clientModule.getPlayerByID(playerId);
      if (!player || !player.remoteID) {
        continue;
      }

      targets.push(player);
      players.delete(player.remoteID);
    }

    if (targets.length) {
      this.clientModule.setPlayersCommType(targets, YacaFilterEnum.RADIO, false, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER);
    }
  }

  /**
   * Starts the radio talking state.
   *
   * @param {boolean} state - The state of the radio talking.
   * @param {number} channel - The radio channel.
   * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
   */
  radioTalkingStart(state: boolean, channel: number, clearPedTasks = true) {
    if (!state) {
      if (this.talkingInChannels.has(channel)) {
        this.talkingInChannels.delete(channel);
        if (!this.clientModule.useWhisper) {
          this.radioTalkingStateToPlugin(false, channel);
        }

        if (this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
          this.clientModule.saltyChatBridge?.handleRadioTalkingStateChange(false, channel);
        }

        emitNet("server:yaca:radioTalking", false, channel);
        emit("yaca:external:isRadioTalking", false, channel);

        if (clearPedTasks) {
          StopAnimTask(cache.ped, "random@arrests", "generic_radio_chatter", 4);
        }
      }

      return;
    }

    const channelSettings = this.radioChannelSettings.get(channel);
    if (!this.radioEnabled || channelSettings?.frequency === "0" || this.talkingInChannels.has(channel)) {
      return;
    }

    this.talkingInChannels.add(channel);
    if (!this.clientModule.useWhisper) {
      this.radioTalkingStateToPlugin(true, channel);
    }

    requestAnimDict("random@arrests").then(() => {
      TaskPlayAnim(cache.ped, "random@arrests", "generic_radio_chatter", 3, -4, -1, 49, 0.0, false, false, false);

      if (this.clientModule.sharedConfig.saltyChatBridge?.enabled) {
        this.clientModule.saltyChatBridge?.handleRadioTalkingStateChange(true, channel);
      }

      emitNet("server:yaca:radioTalking", true, channel);
      emit("yaca:external:isRadioTalking", true, channel);
    });
  }
}
