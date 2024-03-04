import { YaCAServerModule } from "yaca";

export class YaCAServerPhoneModle {
  private serverModule: YaCAServerModule;

  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;

    this.registerExports();
  }

  registerExports() {
    /**
     * Creates a phone call between two players.
     *
     * @param {number} src - The player who is making the call.
     * @param {number} target - The player who is being called.
     * @param {boolean} state - The state of the call.
     */
    exports("callPlayer", (src: number, target: number, state: boolean) =>
      this.callPlayer(src, target, state),
    );

    /**
     * Creates a phone call between two players with the old effect.
     *
     * @param {number} src - The player who is making the call.
     * @param {number} target - The player who is being called.
     * @param {boolean} state - The state of the call.
     */
    exports(
      "callPlayerOldEffect",
      (src: number, target: number, state: boolean) =>
        this.callPlayerOldEffect(src, target, state),
    );

    /**
     * Mute a player during a phone call.
     *
     * @param {number} src - The source-id of the player to mute.
     * @param {boolean} state - The mute state.
     */
    exports("muteOnPhone", (src: number, state: boolean) =>
      this.muteOnPhone(src, state),
    );

    /**
     * Enable or disable the phone speaker for a player.
     *
     * @param {number} src - The source-id of the player to enable the phone speaker for.
     * @param {boolean} state - The state of the phone speaker.
     */
    exports("enablePhoneSpeaker", (src: number, state: boolean) =>
      this.enablePhoneSpeaker(src, state),
    );
  }

  /**
   * Call another player.
   *
   * @param {number} src - The player who is making the call.
   * @param {number} target - The player who is being called.
   * @param {boolean} state - The state of the call.
   */
  callPlayer(src: number, target: number, state: boolean) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    const targetPlayer = players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phone", target, src, state);
    emitNet("client:yaca:phone", src, target, state);

    const playerState = Player(src).state;

    if (state) {
      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, true);
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, false);
    }
  }

  /**
   * Apply the old effect to a player during a call.
   *
   * @param {number} src - The player to apply the old effect to.
   * @param {number} target - The player on the other end of the call.
   * @param {boolean} state - The state of the call.
   */
  callPlayerOldEffect(src: number, target: number, state: boolean) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    const targetPlayer = players.get(target);
    if (!player || !targetPlayer) return;

    emitNet("client:yaca:phoneOld", target, src, state);
    emitNet("client:yaca:phoneOld", src, target, state);

    const playerState = Player(src).state;

    if (state) {
      player.voiceSettings.inCallWith.push(target);
      targetPlayer.voiceSettings.inCallWith.push(src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, true);
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith = player.voiceSettings.inCallWith.filter(
        (id) => id !== target,
      );
      targetPlayer.voiceSettings.inCallWith =
        targetPlayer.voiceSettings.inCallWith.filter((id) => id !== src);

      if (playerState["yaca:phoneSpeaker"]) this.enablePhoneSpeaker(src, false);
    }
  }

  /**
   * Mute a player during a phone call.
   *
   * @param {number} src - The source-id of the player to mute.
   * @param {boolean} state - The mute state.
   * @param {boolean} [onCallStop=false] - Whether the call has stopped. Defaults to false if not provided.
   */
  muteOnPhone(src: number, state: boolean, onCallStop: boolean = false) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    player.voiceSettings.mutedOnPhone = state;
    emitNet("client:yaca:phoneMute", -1, src, state, onCallStop);
  }

  /**
   * Enable or disable the phone speaker for a player.
   *
   * @param {number} src - The source-id of the player to enable the phone speaker for.
   * @param {boolean} state - The state of the phone speaker.
   */
  enablePhoneSpeaker(src: number, state: boolean) {
    const players = this.serverModule.getPlayers();

    const player = players.get(src);
    if (!player) return;

    const playerState = Player(src).state;

    if (state && player.voiceSettings.inCallWith.length) {
      playerState.set(
        "yaca:phoneSpeaker",
        player.voiceSettings.inCallWith,
        true,
      );
    } else {
      playerState.set("yaca:phoneSpeaker", null, true);
    }
  }
}
