import { YaCAServerModule } from "yaca";
import { PHONE_SPEAKER_STATE_NAME } from "common/constants";

/**
 * The phone module for the server.
 */
export class YaCAServerPhoneModle {
  private serverModule: YaCAServerModule;

  /**
   * Creates an instance of the phone module.
   *
   * @param {YaCAServerModule} serverModule - The server module.
   */
  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;

    this.registerEvents();
    this.registerExports();
  }

  /**
   * Register server events.
   */
  registerEvents() {
    /**
     * Handles the "server:yaca:phoneSpeakerEmit" event.
     *
     * @param {number[]} enableForTargets - The IDs of the players to enable the phone speaker for.
     * @param {number[]} disableForTargets - The IDs of the players to disable the phone speaker for.
     */
    onNet("server:yaca:phoneSpeakerEmit", (enableForTargets?: number[], disableForTargets?: number[]) => {
      const player = this.serverModule.players.get(source);
      if (!player) {
        return;
      }

      const sendTo = new Set<number>();

      for (const callTarget of player.voiceSettings.inCallWith) {
        const target = this.serverModule.players.get(callTarget);
        if (!target) {
          continue;
        }

        sendTo.add(callTarget);
      }

      if (enableForTargets?.length) {
        for (const target of sendTo) {
          emitNet("client:yaca:playersToPhoneSpeakerEmit", target, enableForTargets, true);
        }
      }

      if (disableForTargets?.length) {
        for (const target of sendTo) {
          emitNet("client:yaca:playersToPhoneSpeakerEmit", target, disableForTargets, false);
        }
      }
    });
  }

  registerExports() {
    /**
     * Creates a phone call between two players.
     *
     * @param {number} src - The player who is making the call.
     * @param {number} target - The player who is being called.
     * @param {boolean} state - The state of the call.
     */
    exports("callPlayer", (src: number, target: number, state: boolean) => this.callPlayer(src, target, state));

    /**
     * Creates a phone call between two players with the old effect.
     *
     * @param {number} src - The player who is making the call.
     * @param {number} target - The player who is being called.
     * @param {boolean} state - The state of the call.
     */
    exports("callPlayerOldEffect", (src: number, target: number, state: boolean) => this.callPlayerOldEffect(src, target, state));

    /**
     * Mute a player during a phone call.
     *
     * @param {number} src - The source-id of the player to mute.
     * @param {boolean} state - The mute state.
     */
    exports("muteOnPhone", (src: number, state: boolean) => this.muteOnPhone(src, state));

    /**
     * Enable or disable the phone speaker for a player.
     *
     * @param {number} src - The source-id of the player to enable the phone speaker for.
     * @param {boolean} state - The state of the phone speaker.
     */
    exports("enablePhoneSpeaker", (src: number, state: boolean) => this.enablePhoneSpeaker(src, state));

    /**
     * Is player in a phone call.
     *
     * @param {number} src - The source-id of the player to check.
     */
    exports("isPlayerInCall", (src: number): [boolean, number[]] => {
      const player = this.serverModule.players.get(src);
      if (!player) {
        return [false, []];
      }

      return [player.voiceSettings.inCallWith.size > 0, [...player.voiceSettings.inCallWith]];
    });
  }

  /**
   * Call another player.
   *
   * @param {number} src - The player who is making the call.
   * @param {number} target - The player who is being called.
   * @param {boolean} state - The state of the call.
   */
  callPlayer(src: number, target: number, state: boolean) {
    const player = this.serverModule.getPlayer(src),
      targetPlayer = this.serverModule.getPlayer(target);
    if (!player || !targetPlayer) {
      return;
    }

    emitNet("client:yaca:phone", target, src, state);
    emitNet("client:yaca:phone", src, target, state);

    const playerState = Player(src).state;
    const targetState = Player(target).state;

    if (state) {
      player.voiceSettings.inCallWith.add(target);
      targetPlayer.voiceSettings.inCallWith.add(src);

      if (playerState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(src, true);
      }

      if (targetState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(target, true);
      }
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith.delete(target);
      targetPlayer.voiceSettings.inCallWith.delete(src);

      if (playerState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(src, false);
      }

      if (targetState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(target, false);
      }
    }

    emit("yaca:external:phoneCall", src, target, state);
  }

  /**
   * Apply the old effect to a player during a call.
   *
   * @param {number} src - The player to apply the old effect to.
   * @param {number} target - The player on the other end of the call.
   * @param {boolean} state - The state of the call.
   */
  callPlayerOldEffect(src: number, target: number, state: boolean) {
    const player = this.serverModule.getPlayer(src),
      targetPlayer = this.serverModule.getPlayer(target);
    if (!player || !targetPlayer) {
      return;
    }

    emitNet("client:yaca:phoneOld", target, src, state);
    emitNet("client:yaca:phoneOld", src, target, state);

    const playerState = Player(src).state;
    const targetState = Player(target).state;

    if (state) {
      player.voiceSettings.inCallWith.add(target);
      targetPlayer.voiceSettings.inCallWith.add(src);

      if (playerState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(src, true);
      }

      if (targetState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(target, true);
      }
    } else {
      this.muteOnPhone(src, false, true);
      this.muteOnPhone(target, false, true);

      player.voiceSettings.inCallWith.delete(target);
      targetPlayer.voiceSettings.inCallWith.delete(src);

      if (playerState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(src, false);
      }

      if (targetState[PHONE_SPEAKER_STATE_NAME]) {
        this.enablePhoneSpeaker(target, false);
      }
    }

    emit("yaca:external:phoneCallOldEffect", src, target, state);
  }

  /**
   * Mute a player during a phone call.
   *
   * @param {number} src - The source-id of the player to mute.
   * @param {boolean} state - The mute state.
   * @param {boolean} [onCallStop=false] - Whether the call has stopped. Defaults to false if not provided.
   */
  muteOnPhone(src: number, state: boolean, onCallStop = false) {
    const player = this.serverModule.getPlayer(src);
    if (!player) {
      return;
    }

    player.voiceSettings.mutedOnPhone = state;
    emitNet("client:yaca:phoneMute", -1, src, state, onCallStop);
    emit("yaca:external:phoneMute", src, state);
  }

  /**
   * Enable or disable the phone speaker for a player.
   *
   * @param {number} src - The source-id of the player to enable the phone speaker for.
   * @param {boolean} state - The state of the phone speaker.
   */
  enablePhoneSpeaker(src: number, state: boolean) {
    const player = this.serverModule.getPlayer(src);
    if (!player) {
      return;
    }

    const playerState = Player(src).state;

    if (state && player.voiceSettings.inCallWith.size) {
      playerState.set(PHONE_SPEAKER_STATE_NAME, Array.from(player.voiceSettings.inCallWith), true);
      emit("yaca:external:phoneSpeaker", src, true);
    } else {
      playerState.set(PHONE_SPEAKER_STATE_NAME, null, true);
      emit("yaca:external:phoneSpeaker", src, false);
    }
  }
}
