import type { YaCAClientModule } from "yaca";
import {
  CommDeviceMode,
  YacaFilterEnum,
  type YacaRadioSettings,
  YacaStereoMode,
} from "types";
import { cache, requestAnimDict } from "@overextended/ox_lib/client";

export class YaCAClientRadioModule {
  clientModule: YaCAClientModule;

  radioFrequencySet = false;
  radioToggle = false;
  radioEnabled = false;
  radioTalking = false;
  radioChannelSettings: { [key: number]: YacaRadioSettings } = {};
  radioInitialized = false;
  activeRadioChannel = 1;
  playersWithShortRange = new Map();
  playersInRadioChannel: Map<number, Set<number>> = new Map();

  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
    this.registerKeybinds();
    if (this.clientModule.sharedConfig.debug) this.registerDebugCommands();
  }

  registerEvents() {
    /*
      this.webview.on('client:yaca:enableRadio', (state) => {});
      this.webview.on('client:yaca:changeRadioFrequency', (frequency) => {});
      this.webview.on('client:yaca:muteRadioChannel', () => {});
      this.webview.on('client:yaca:changeActiveRadioChannel', (channel) => {});
      this.webview.on('client:yaca:changeRadioChannelVolume', (higher) => {});
      this.webview.on("client:yaca:changeRadioChannelStereo", () => {});
      //TODO: Implement, will be used if player activates radio speaker so everyone around him can hear it
      this.webview.on("client:yaca:changeRadioSpeaker", () => {})
    */

    onNet("client:yaca:setRadioFreq", (channel: number, frequency: string) => {
      this.setRadioFrequency(channel, frequency);
    });

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
        if (!channel) return;

        const player = this.clientModule.getPlayerByID(target);
        if (!player) return;

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

    onNet(
      "client:yaca:setRadioMuteState",
      (channel: number, state: boolean) => {
        this.radioChannelSettings[channel].muted = state;
        this.updateRadioInWebview(channel);
        this.disableRadioFromPlayerInChannel(channel);
      },
    );

    onNet(
      "client:yaca:leaveRadioChannel",
      (client_ids: number | number[], frequency: string) => {
        if (!Array.isArray(client_ids)) client_ids = [client_ids];

        const channel = this.findRadioChannelByFrequency(frequency);
        if (!channel) return;

        const playerData = this.clientModule.getPlayerByID(cache.serverId);
        if (!playerData || !playerData.clientId) return;

        if (client_ids.includes(playerData.clientId))
          this.setRadioFrequency(channel, "0");

        this.clientModule.sendWebsocket({
          base: { request_type: "INGAME" },
          comm_device_left: {
            comm_type: YacaFilterEnum.RADIO,
            client_ids: client_ids,
            channel: channel,
          },
        });
      },
    );
  }

  registerKeybinds() {
    RegisterCommand(
      "yaca:radioUI",
      () => {
        this.openRadio();
      },
      false,
    );
    // RegisterKeyMapping('yaca:radioUI', 'Radio UI', 'keyboard', 'F10')

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
    RegisterKeyMapping("+yaca:radioTalking", "Funken", "keyboard", "N");
  }

  registerDebugCommands() {
    RegisterCommand(
      "enableRadio",
      () => {
        this.enableRadio(true);
      },
      false,
    );

    RegisterCommand(
      "disableRadio",
      () => {
        this.enableRadio(false);
      },
      false,
    );

    RegisterCommand(
      "changeRadioChannel",
      (_source: number, args: string[]) => {
        this.changeActiveRadioChannel(parseInt(args[0]));
      },
      false,
    );

    RegisterCommand(
      "changeRadioFrequency",
      (_source: number, args: string[]) => {
        this.changeRadioFrequency(args[0]);
      },
      false,
    );

    RegisterCommand(
      "muteRadioChannel",
      () => {
        this.muteRadioChannel();
      },
      false,
    );

    RegisterCommand(
      "changeRadioChannelVolume",
      (_source: number, args: string[]) => {
        this.changeRadioChannelVolume(args[0] == "true");
      },
      false,
    );

    RegisterCommand(
      "changeRadioChannelStereo",
      () => {
        this.changeRadioChannelStereo();
      },
      false,
    );
  }

  /* ======================== RADIO SYSTEM ======================== */

  /**
   * Enable or disable the radio system.
   *
   * @param {boolean} state - The state of the radio system.
   */
  enableRadio(state: boolean) {
    if (!this.clientModule.isPluginInitialized()) return;

    if (this.radioEnabled != state) {
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

      // TODO: this.webview.emit('webview:hud:radioState', state);

      if (state && !this.radioInitialized) {
        this.radioInitialized = true;
        this.initRadioSettings();
        this.updateRadioInWebview(this.activeRadioChannel);
      }
    }
  }

  changeRadioFrequency(frequency: string) {
    if (!this.clientModule.isPluginInitialized()) return;

    emitNet(
      "server:yaca:changeRadioFrequency",
      this.activeRadioChannel,
      frequency,
    );
  }

  muteRadioChannel() {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) return;

    const channel = this.activeRadioChannel;
    if (this.radioChannelSettings[channel].frequency == "0") return;
    emitNet("server:yaca:muteRadioChannel", channel);
  }

  /**
   * Change the active radio channel.
   *
   * @param channel - The new radio channel.
   */
  changeActiveRadioChannel(channel: number) {
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) return;

    emitNet("server:yaca:changeActiveRadioChannel", channel);
    this.activeRadioChannel = channel;
    this.updateRadioInWebview(channel);
  }

  changeRadioChannelVolume(higher: boolean) {
    if (
      !this.clientModule.isPluginInitialized() ||
      !this.radioEnabled ||
      this.radioChannelSettings[this.activeRadioChannel].frequency == "0"
    )
      return;

    const channel = this.activeRadioChannel;
    const oldVolume = this.radioChannelSettings[channel].volume;
    this.radioChannelSettings[channel].volume = this.clientModule.clamp(
      oldVolume + (higher ? 0.17 : -0.17),
      0,
      1,
    );

    // Prevent event emit spams, if nothing changed
    if (oldVolume == this.radioChannelSettings[channel].volume) return;

    if (
      this.radioChannelSettings[channel].volume == 0 ||
      (oldVolume == 0 && this.radioChannelSettings[channel].volume > 0)
    ) {
      emitNet("server:yaca:muteRadioChannel", channel);
    }

    // Prevent duplicate update, cuz mute has its own update
    if (this.radioChannelSettings[channel].volume > 0)
      this.updateRadioInWebview(channel);

    // Send update to voiceplugin
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
    if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) return;

    const channel = this.activeRadioChannel;

    switch (this.radioChannelSettings[channel].stereo) {
      case YacaStereoMode.STEREO:
        this.radioChannelSettings[channel].stereo = YacaStereoMode.MONO_LEFT;
        this.clientModule.radarNotification(
          `Kanal ${channel} ist nun auf der linken Seite hörbar.`,
        );
        break;
      case YacaStereoMode.MONO_LEFT:
        this.radioChannelSettings[channel].stereo = YacaStereoMode.MONO_RIGHT;
        this.clientModule.radarNotification(
          `Kanal ${channel} ist nun auf der rechten Seite hörbar.`,
        );
        break;
      case YacaStereoMode.MONO_RIGHT:
        this.radioChannelSettings[channel].stereo = YacaStereoMode.STEREO;
        this.clientModule.radarNotification(
          `Kanal ${channel} ist nun auf beiden Seiten hörbar.`,
        );
    }

    this.clientModule.setCommDeviceStereomode(
      YacaFilterEnum.RADIO,
      this.radioChannelSettings[channel].stereo,
      channel,
    );
  }

  // TODO: Implement the radio UI
  openRadio() {
    if (!this.radioToggle /* && !alt.isCursorVisible() */) {
      this.radioToggle = true;
      /* alt.showCursor(true);
      this.webview.emit('webview:radio:openState', true);
      NKeyhandler.disableAllKeybinds("radioUI", true, ["yaca:radioUI", "yaca:radioTalking"], ["yaca:radioTalking"]) */
    } else if (this.radioToggle) {
      this.closeRadio();
    }
  }

  /**
   * Cleanup different things, if player closes his radio.
   */
  closeRadio() {
    this.radioToggle = false;

    /* alt.showCursor(false);
    this.webview.emit('webview:radio:openState', false);
    NKeyhandler.disableAllKeybinds("radioUI", false, ["yaca:radioUI", "yaca:radioTalking"], ["yaca:radioTalking"]); */
  }

  /**
   * Set volume & stereo mode for all radio channels on first start and reconnect.
   */
  initRadioSettings() {
    for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
      if (!this.radioChannelSettings[i])
        this.radioChannelSettings[i] = Object.assign(
          {},
          this.clientModule.sharedConfig.defaultRadioChannelSettings,
        );
      if (!this.playersInRadioChannel.has(i))
        this.playersInRadioChannel.set(i, new Set());

      const volume = this.radioChannelSettings[i].volume;
      const stereo = this.radioChannelSettings[i].stereo;

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
      cache.serverId,
      YacaFilterEnum.RADIO,
      state,
      this.activeRadioChannel,
      undefined,
      CommDeviceMode.SENDER,
      CommDeviceMode.RECEIVER,
    );
  }

  radioTalkingStateToPluginWithWhisper(
    state: boolean,
    targets: number | number[],
  ) {
    if (!Array.isArray(targets)) targets = [targets];

    const comDeviceTargets = [];
    for (const target of targets) {
      const player = this.clientModule.getPlayerByID(target);
      if (!player) continue;

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
   * Updates the UI when a player changes the radio channel.
   *
   * @param {number} channel - The new radio channel.
   */
  updateRadioInWebview(channel: number) {
    if (channel != this.activeRadioChannel) return;

    // this.webview.emit("webview:radio:setChannelData", this.radioChannelSettings[channel]);
    // this.webview.emit('webview:hud:radioChannel', channel, this.radioChannelSettings[channel].muted);
  }

  /**
   * Finds a radio channel by a given frequency.
   *
   * @param {string} frequency - The frequency to search for.
   * @returns {number | undefined} The channel number if found, undefined otherwise.
   */
  findRadioChannelByFrequency(frequency: string): number | undefined {
    let foundChannel;
    for (const channel in this.radioChannelSettings) {
      const data = this.radioChannelSettings[channel];
      if (data.frequency == frequency) {
        foundChannel = parseInt(channel);
        break;
      }
    }

    return foundChannel;
  }

  setRadioFrequency(channel: number, frequency: string) {
    this.radioFrequencySet = true;

    if (this.radioChannelSettings[channel].frequency != frequency) {
      this.disableRadioFromPlayerInChannel(channel);
    }

    this.radioChannelSettings[channel].frequency = frequency;
  }

  /**
   * Disable radio effect for all players in the given channel.
   *
   * @param {number} channel - The channel number.
   */
  disableRadioFromPlayerInChannel(channel: number) {
    if (!this.playersInRadioChannel.has(channel)) return;

    const players = this.playersInRadioChannel.get(channel);
    if (!players?.size) return;

    const targets = [];
    for (const playerId of players) {
      const player = this.clientModule.getPlayerByID(playerId);
      if (!player || !player.remoteID) continue;

      targets.push(player);
      players.delete(player.remoteID);
    }

    if (targets.length)
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

  /**
   * Starts the radio talking state.
   *
   * @param {boolean} state - The state of the radio talking.
   * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
   */
  radioTalkingStart(state: boolean, clearPedTasks: boolean = true) {
    if (!state) {
      if (this.radioTalking) {
        this.radioTalking = false;
        if (!this.clientModule.useWhisper)
          this.radioTalkingStateToPlugin(false);
        emitNet("server:yaca:radioTalking", false);
        // this.webview.emit('webview:hud:isRadioTalking', false);
        if (clearPedTasks)
          StopAnimTask(cache.ped, "random@arrests", "generic_radio_chatter", 4);
      }

      return;
    }

    if (!this.radioEnabled || !this.radioFrequencySet || this.radioTalking)
      return;

    this.radioTalking = true;
    if (!this.clientModule.useWhisper) this.radioTalkingStateToPlugin(true);

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
      // this.webview.emit('webview:hud:isRadioTalking', true);
    });
  }
}
