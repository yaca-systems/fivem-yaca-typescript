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

    this.registerExports();
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
  }

  getPlayersInRadioFrequency(frequency: string) {
    const players = this.serverModule.getPlayers();
    const allPlayersInChannel = this.radioFrequencyMap.get(frequency);
    const playersArray = [];
    for (const [key] of allPlayersInChannel) {
      const target = players.get(key);
      if (!target) continue;
      playersArray.push(key);
    }
    return playersArray;
  }

  /**
   * Checks if a player is permitted to use long radio.
   */
  isLongRadioPermitted(src: number) {
    if (!src) return;
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    player.radioSettings.hasLong = true; //Add some checks if you want shortrange system;
  }

  /**
   * Enable or disable the radio for a player.
   *
   * @param {number} src - The player to enable or disable the radio for.
   * @param {boolean} state - The new state of the radio.
   */
  enableRadio(src: number, state: boolean) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    player.radioSettings.activated = state;
    this.isLongRadioPermitted(src);
  }

  /**
   * Change the radio frequency for a player.
   *
   * @param {number} src - The player to change the radio frequency for.
   * @param {number} channel - The channel to change the frequency of.
   * @param {string} frequency - The new frequency.
   */
  changeRadioFrequency(src: number, channel: number, frequency: string) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    if (!player.radioSettings.activated)
      return emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Das Funkgerät ist aus!",
      });
    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    )
      return emitNet("ox_lib:notify", src, {
        type: "error",
        description: "Fehlerhafter Funk Kanal!",
      });

    // Leave radiochannel if frequency is 0
    if (frequency == "0")
      return this.leaveRadioFrequency(src, channel, frequency);

    if (player.radioSettings.frequencies[channel] != frequency) {
      this.leaveRadioFrequency(
        src,
        channel,
        player.radioSettings.frequencies[channel],
      );
    }

    // Add player to channel map, so we know who is in which channel
    if (!this.radioFrequencyMap.has(frequency))
      this.radioFrequencyMap.set(frequency, new Map());
    this.radioFrequencyMap.get(frequency).set(source, { muted: false });

    player.radioSettings.frequencies[channel] = frequency;

    emitNet("client:yaca:setRadioFreq", source, channel, frequency);

    //TODO: Add radio effect to player in new frequency
    // const newPlayers = this.getPlayersInRadioFrequency(frequency);
    // if (newPlayers.length) alt.emitClientRaw(newPlayers, "client:yaca:setRadioEffectInFrequency", frequency, player.id);
  }

  /**
   * Make a player leave a radio frequency.
   *
   * @param {number} src - The player to leave the radio frequency.
   * @param {number} channel - The channel to leave.
   * @param {string} frequency - The frequency to leave.
   */
  leaveRadioFrequency(src: number, channel: number, frequency: string) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    frequency =
      frequency == "0" ? player.radioSettings.frequencies[channel] : frequency;

    if (!this.radioFrequencyMap.has(frequency)) return;

    const allPlayersInChannel = this.radioFrequencyMap.get(frequency);

    player.radioSettings.frequencies[channel] = "0";

    const playersArray = [];
    const allTargets = [];
    for (const [key] of allPlayersInChannel) {
      const target = players.get(key);
      if (!target) continue;

      playersArray.push(key);

      if (key == source) continue;

      allTargets.push(key);
    }

    if (!this.serverConfig.useWhisper && playersArray.length) {
      for (const target of allTargets) {
        if (player.voicePlugin)
          emitNet(
            "client:yaca:leaveRadioChannel",
            target,
            player.voicePlugin.clientId,
            frequency,
          );
      }
    }
    if (this.serverConfig.useWhisper)
      emitNet(
        "client:yaca:radioTalking",
        source,
        allTargets,
        frequency,
        false,
        null,
        true,
      );

    allPlayersInChannel.delete(source);
    if (!this.radioFrequencyMap.get(frequency).size)
      this.radioFrequencyMap.delete(frequency);
  }

  /**
   * Mute a radio channel for a player.
   *
   * @param {number} src - The player to mute the radio channel for.
   * @param {number} channel - The channel to mute.
   */
  radioChannelMute(src: number, channel: number) {
    const players = this.serverModule.getPlayers();
    const player = players.get(src);
    if (!player) return;

    const radioFrequency = player.radioSettings.frequencies[channel];
    const foundPlayer = this.radioFrequencyMap.get(radioFrequency)?.get(src);
    if (!foundPlayer) return;

    foundPlayer.muted = !foundPlayer.muted;
    emitNet(
      "client:yaca:setRadioMuteState",
      src,
      radioFrequency,
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
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    if (
      isNaN(channel) ||
      channel < 1 ||
      channel > this.sharedConfig.maxRadioChannels
    )
      return;

    player.radioSettings.currentChannel = channel;
  }

  /**
   * Change the talking state of a player on the radio.
   *
   * @param {number} src - The player to change the talking state for.
   * @param {boolean} state - The new talking state.
   */
  radioTalkingState(src: number, state: boolean) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player || !player.radioSettings.activated) return;

    const radioFrequency =
      player.radioSettings.frequencies[player.radioSettings.currentChannel];
    if (!radioFrequency) return;

    const getPlayers = this.radioFrequencyMap.get(radioFrequency);
    let targets = [];
    const targetsToSender = [];
    const radioInfos: { [key: number]: { shortRange: boolean } } = {};
    for (const [key, values] of getPlayers) {
      if (values.muted) {
        if (key == source) {
          targets = [];
          break;
        }
        continue;
      }

      if (key == source) continue;
      const target = players.get(key);
      if (!target || !target.radioSettings.activated) continue;

      const shortRange =
        !player.radioSettings.hasLong && !target.radioSettings.hasLong;
      if (
        (player.radioSettings.hasLong && target.radioSettings.hasLong) ||
        shortRange
      ) {
        targets.push(key);

        radioInfos[key] = {
          shortRange: shortRange,
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
    if (this.serverConfig.useWhisper)
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
