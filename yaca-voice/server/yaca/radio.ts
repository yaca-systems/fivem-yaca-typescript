import { YaCAServerModule } from "yaca";
import type { YacaServerConfig, YacaSharedConfig } from "types";

export class YaCAServerRadioModule {
  private serverModule: YaCAServerModule;
  private sharedConfig: YacaSharedConfig;
  private serverConfig: YacaServerConfig;

  radioFrequencyMap = new Map();

  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;
    this.sharedConfig = serverModule.sharedConfig;
    this.serverConfig = serverModule.serverConfig;

    this.registerEvents();
    this.registerExports();
  }

  registerEvents() {
    /**
     * Handles the "server:yaca:enableRadio" server event.
     *
     * @param {boolean} state - The state of the radio.
     */
    onNet("server:yaca:enableRadio", (state: boolean) => {
      this.enableRadio(source, state);
    });

    /**
     * Handles the "server:yaca:changeRadioFrequency" server event.
     *
     * @param {number} channel - The channel to change the frequency of.
     * @param {string} frequency - The new frequency.
     */
    onNet(
      "server:yaca:changeRadioFrequency",
      (channel: number, frequency: string) => {
        this.changeRadioFrequency(source, channel, frequency);
      },
    );

    /**
     * Handles the "server:yaca:muteRadioChannel" server event.
     *
     * @param {number} channel - The channel to mute.
     */
    onNet("server:yaca:muteRadioChannel", (channel: number) => {
      this.radioChannelMute(source, channel);
    });

    /**
     * Handles the "server:yaca:radioTalking" server event.
     *
     * @param {boolean} state - The state of the radio.
     */
    onNet("server:yaca:radioTalking", (state: boolean) => {
      this.radioTalkingState(source, state);
    });

    /**
     * Handles the "server:yaca:changeActiveRadioChannel" server event.
     *
     * @param {number} channel - The channel to change the frequency of.
     */
    onNet("server:yaca:changeActiveRadioChannel", (channel: number) => {
      this.radioActiveChannelChange(source, channel);
    });
  }

  registerExports() {
    /**
     * Get all players in a radio frequency.
     *
     * @param {string} frequency - The frequency to get the players for.
     * @returns {number[]} - The players in the radio frequency.
     */
    exports("getPlayersInRadioFrequency", (frequency: string) =>
      this.getPlayersInRadioFrequency(frequency),
    );

    /**
     * Set the radio channel for a player.
     *
     * @param {number} src - The player to set the radio channel for.
     * @param {number} channel - The channel to set.
     * @param {string} frequency - The frequency to set.
     */
    exports(
      "setPlayerRadioChannel",
      (src: number, channel: number, frequency: string) =>
        this.changeRadioFrequency(src, channel, frequency),
    );

    /**
     * Get if a player has long range radio.
     *
     * @param {number} src - The player to set the long range radio for.
     */
    exports("getPlayerHasLongRange", (src: number) =>
      this.getPlayerHasLongRange(src),
    );

    /**
     * Set if a player has long range radio.
     *
     * @param {number} src - The player to set the long range radio for.
     * @param {boolean} state - The new state of the long range radio.
     */
    exports("setPlayerHadLongRange", (src: number, state: boolean) =>
      this.setPlayerHadLongRange(src, state),
    );
  }

  /**
   * Get all players in a radio frequency.
   *
   * @param frequency - The frequency to get the players for.
   */
  getPlayersInRadioFrequency(frequency: string) {
    const players = this.serverModule.getPlayers(),
      allPlayersInChannel = this.radioFrequencyMap.get(frequency),
      playersArray = [];
    for (const [key] of allPlayersInChannel) {
      const target = players.get(key);
      if (!target) {
        continue;
      }
      playersArray.push(key);
    }
    return playersArray;
  }

  /**
   * Gets if a player has long range radio.
   *
   * @param src - The player to get the long range radio for.
   */
  getPlayerHasLongRange(src: number) {
    const player = this.serverModule.getPlayers().get(src);
    if (!player) {
      return;
    }

    return player.radioSettings.hasLong;
  }

  /**
   * Sets if a player has long range radio.
   *
   * @param src - The player to set the long range radio for.
   * @param state - The new state of the long range radio.
   */
  setPlayerHadLongRange(src: number, state: boolean) {
    const player = this.serverModule.getPlayers().get(src);
    if (!player) {
      return;
    }

    player.radioSettings.hasLong = state;
  }

  /**
   * Enable or disable the radio for a player.
   *
   * @param {number} src - The player to enable or disable the radio for.
   * @param {boolean} state - The new state of the radio.
   */
  enableRadio(src: number, state: boolean) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    player.radioSettings.activated = state;
    emit("yaca:export:enabledRadio", src, state);
  }

  /**
   * Change the radio frequency for a player.
   *
   * @param {number} src - The player to change the radio frequency for.
   * @param {number} channel - The channel to change the frequency of.
   * @param {string} frequency - The new frequency.
   */
  changeRadioFrequency(src: number, channel: number, frequency: string) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    if (!player.radioSettings.activated) {
      emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Das Funkgerät ist aus!",
      });
      return;
    }
    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    ) {
      emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Fehlerhafter Funk Kanal!",
      });
      return;
    }

    // Leave radiochannel if frequency is 0
    if (frequency === "0") {
      this.leaveRadioFrequency(src, channel, frequency);
      return;
    }

    if (player.radioSettings.frequencies[channel] !== frequency) {
      this.leaveRadioFrequency(
        src,
        channel,
        player.radioSettings.frequencies[channel],
      );
    }

    // Add player to channel map, so we know who is in which channel
    if (!this.radioFrequencyMap.has(frequency)) {
      this.radioFrequencyMap.set(frequency, new Map());
    }
    this.radioFrequencyMap.get(frequency).set(src, { muted: false });

    player.radioSettings.frequencies[channel] = frequency;

    emitNet("client:yaca:setRadioFreq", src, channel, frequency);
    emit("yaca:external:changedRadioFrequency", src, channel, frequency);

    /*
     * TODO: Add radio effect to player in new frequency
     *  const newPlayers = this.getPlayersInRadioFrequency(frequency);
     *  if (newPlayers.length) alt.emitClientRaw(newPlayers, "client:yaca:setRadioEffectInFrequency", frequency, player.id);
     */
  }

  /**
   * Make a player leave a radio frequency.
   *
   * @param {number} src - The player to leave the radio frequency.
   * @param {number} channel - The channel to leave.
   * @param {string} frequency - The frequency to leave.
   */
  leaveRadioFrequency(src: number, channel: number, frequency: string) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    frequency =
      frequency === "0" ? player.radioSettings.frequencies[channel] : frequency;

    if (!this.radioFrequencyMap.has(frequency)) {
      return;
    }

    const allPlayersInChannel = this.radioFrequencyMap.get(frequency);

    player.radioSettings.frequencies[channel] = "0";

    const playersArray = [],
      allTargets = [];
    for (const [key] of allPlayersInChannel) {
      const target = players.get(key);
      if (!target) {
        continue;
      }

      playersArray.push(key);

      if (key === src) {
        continue;
      }

      allTargets.push(key);
    }

    if (!this.serverConfig.useWhisper && playersArray.length) {
      for (const target of playersArray) {
        if (player.voicePlugin) {
          emitNet(
            "client:yaca:leaveRadioChannel",
            target,
            player.voicePlugin.clientId,
            frequency,
          );
        }
      }
    }
    if (this.serverConfig.useWhisper) {
      emitNet(
        "client:yaca:radioTalking",
        src,
        allTargets,
        frequency,
        false,
        null,
        true,
      );
    }

    allPlayersInChannel.delete(src);
    if (!this.radioFrequencyMap.get(frequency).size) {
      this.radioFrequencyMap.delete(frequency);
    }
  }

  /**
   * Mute a radio channel for a player.
   *
   * @param {number} src - The player to mute the radio channel for.
   * @param {number} channel - The channel to mute.
   */
  radioChannelMute(src: number, channel: number) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    const radioFrequency = player.radioSettings.frequencies[channel],
      foundPlayer = this.radioFrequencyMap.get(radioFrequency)?.get(src);
    if (!foundPlayer) {
      return;
    }

    foundPlayer.muted = !foundPlayer.muted;
    emitNet("client:yaca:setRadioMuteState", src, channel, foundPlayer.muted);
    emit(
      "yaca:external:changedRadioMuteState",
      src,
      channel,
      foundPlayer.muted,
    );
  }

  /**
   * Change the active radio channel for a player.
   *
   * @param {number} src - The player to change the active channel for.
   * @param {number} channel - The new active channel.
   */
  radioActiveChannelChange(src: number, channel: number) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    ) {
      return;
    }

    player.radioSettings.currentChannel = channel;
    emit("yaca:external:changedRadioActiveChannel", src, channel);
  }

  /**
   * Change the talking state of a player on the radio.
   *
   * @param {number} src - The player to change the talking state for.
   * @param {boolean} state - The new talking state.
   */
  radioTalkingState(src: number, state: boolean) {
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player || !player.radioSettings.activated) {
      return;
    }

    const radioFrequency =
      player.radioSettings.frequencies[player.radioSettings.currentChannel];
    if (!radioFrequency) {
      return;
    }

    const getPlayers = this.radioFrequencyMap.get(radioFrequency);
    let targets = [];
    const targetsToSender = [],
      radioInfos: { [key: number]: { shortRange: boolean } } = {};
    for (const [key, values] of getPlayers) {
      if (values.muted) {
        if (key === src) {
          targets = [];
          break;
        }
        continue;
      }

      if (key === src) {
        continue;
      }
      const target = players.get(key);
      if (!target || !target.radioSettings.activated) {
        continue;
      }

      const shortRange =
        !player.radioSettings.hasLong && !target.radioSettings.hasLong;
      if (
        (player.radioSettings.hasLong && target.radioSettings.hasLong) ||
        shortRange
      ) {
        targets.push(key);

        radioInfos[key] = {
          shortRange,
        };

        targetsToSender.push(key);
      }
    }

    if (targets.length) {
      for (const target of targets) {
        emitNet(
          "client:yaca:radioTalking",
          target,
          src,
          radioFrequency,
          state,
          radioInfos,
        );
      }
    }
    if (this.serverConfig.useWhisper) {
      emitNet(
        "client:yaca:radioTalking",
        src,
        targetsToSender,
        radioFrequency,
        state,
        radioInfos,
        true,
      );
    }
  }
}