import type { YaCAClientModule } from "yaca";
import { CommDeviceMode, YacaFilterEnum } from "types";
import { cache } from "../utils";
import { CLIENT_ID_STATE_NAME, PHONE_SPEAKER_STATE_NAME } from "common/const";

/**
 * The phone module for the client.
 */
export class YaCAClientPhoneModule {
  clientModule: YaCAClientModule;

  inCall = false;
  phoneSpeakerActive = false;
  phoneCallMemberIds = new Map<number, number[]>();

  /**
   * Creates an instance of the phone module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
    this.registerStateBagHandlers();
  }

  registerEvents() {
    /**
     * Handles the "client:yaca:phone" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet("client:yaca:phone", (targetID: number, state: boolean) => {
      const targetState = Player(targetID).state;
      if (!targetState[CLIENT_ID_STATE_NAME]) {
        return;
      }

      this.inCall = state;
      this.clientModule.setPlayersCommType(
        targetState[CLIENT_ID_STATE_NAME],
        YacaFilterEnum.PHONE,
        state,
        undefined,
        undefined,
        CommDeviceMode.TRANSCEIVER,
        CommDeviceMode.TRANSCEIVER,
      );
    });

    /**
     * Handles the "client:yaca:phoneOld" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet("client:yaca:phoneOld", (targetID: number, state: boolean) => {
      const targetState = Player(targetID).state;
      if (!targetState[CLIENT_ID_STATE_NAME]) {
        return;
      }

      this.inCall = state;
      this.clientModule.setPlayersCommType(
        targetState[CLIENT_ID_STATE_NAME],
        YacaFilterEnum.PHONE_HISTORICAL,
        state,
        undefined,
        undefined,
        CommDeviceMode.TRANSCEIVER,
        CommDeviceMode.TRANSCEIVER,
      );
    });

    /**
     * Handles the "client:yaca:phoneMute" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone mute.
     * @param {boolean} onCallStop - The state of the call.
     */
    onNet("client:yaca:phoneMute", (targetID: number, state: boolean, onCallStop = false) => {
      const targetState = Player(targetID).state;

      /*
        TODO: Brachen wir das?
        const target = this.clientModule.getPlayerByID(targetID);
        if (!target) {
          return;
        }

        target.mutedOnPhone = state;
      */

      if (onCallStop) {
        return;
      }

      if (this.clientModule.useWhisper && targetID === cache.serverId) {
        this.clientModule.setPlayersCommType([], YacaFilterEnum.PHONE, !state, undefined, undefined, CommDeviceMode.SENDER);
      } else if (!this.clientModule.useWhisper) {
        if (state) {
          this.clientModule.setPlayersCommType(
            targetState[CLIENT_ID_STATE_NAME],
            YacaFilterEnum.PHONE,
            false,
            undefined,
            undefined,
            CommDeviceMode.TRANSCEIVER,
            CommDeviceMode.TRANSCEIVER,
          );
        } else {
          this.clientModule.setPlayersCommType(
            targetState[CLIENT_ID_STATE_NAME],
            YacaFilterEnum.PHONE,
            true,
            undefined,
            undefined,
            CommDeviceMode.TRANSCEIVER,
            CommDeviceMode.TRANSCEIVER,
          );
        }
      }
    });

    /**
     * Handles the "client:yaca:phoneSpeaker" server event.
     *
     * @param {number | number[]} playerIDs - The IDs of the players to be added or removed from the phone speaker.
     * @param {boolean} state - The state indicating whether to add or remove the players.
     */
    onNet("client:yaca:playersToPhoneSpeakerEmit", (playerIDs: number | number[], state: boolean) => {
      if (!Array.isArray(playerIDs)) {
        playerIDs = [playerIDs];
      }

      const applyRemovePhoneSpeaker: Set<number> = new Set();
      for (const playerID of playerIDs) {
        const playerState = Player(playerID).state;
        if (!playerState[CLIENT_ID_STATE_NAME]) {
          continue;
        }

        applyRemovePhoneSpeaker.add(playerState[CLIENT_ID_STATE_NAME]);
      }

      if (applyRemovePhoneSpeaker.size < 1) {
        return;
      }

      if (state) {
        this.clientModule.setPlayersCommType(
          Array.from(applyRemovePhoneSpeaker),
          YacaFilterEnum.PHONE_SPEAKER,
          true,
          undefined,
          undefined,
          CommDeviceMode.SENDER,
          CommDeviceMode.RECEIVER,
        );
      } else {
        this.clientModule.setPlayersCommType(
          Array.from(applyRemovePhoneSpeaker),
          YacaFilterEnum.PHONE_SPEAKER,
          false,
          undefined,
          undefined,
          CommDeviceMode.SENDER,
          CommDeviceMode.RECEIVER,
        );
      }
    });
  }

  registerStateBagHandlers() {
    /**
     * Handles the "yaca:phone" state bag change.
     */
    AddStateBagChangeHandler(PHONE_SPEAKER_STATE_NAME, "", (bagName: string, _: string, value: object, __: number, replicated: boolean) => {
      if (replicated) {
        return;
      }

      const playerId = GetPlayerFromStateBagName(bagName);
      if (playerId === 0) {
        return;
      }

      const playerSource = GetPlayerServerId(playerId);
      if (playerSource === 0) {
        return;
      }

      if (playerSource === cache.serverId) {
        this.phoneSpeakerActive = value !== null;
      }

      this.removePhoneSpeakerFromEntity(playerSource);
      if (value !== null) {
        this.phoneCallMemberIds.set(playerSource, Array.isArray(value) ? value : [value]);
      }
    });
  }

  /**
   * Removes the phone speaker effect from a player entity.
   *
   * @param {number} player - The player entity from which the phone speaker effect is to be removed.
   */
  removePhoneSpeakerFromEntity(player: number) {
    const phoneCallMemberIds = this.phoneCallMemberIds.get(player);
    if (!phoneCallMemberIds) {
      return;
    }

    const playersToSet = new Set<number>();
    for (const phoneCallMemberId of phoneCallMemberIds) {
      const phoneCallMemberState = Player(phoneCallMemberId).state;
      if (!phoneCallMemberState[CLIENT_ID_STATE_NAME]) {
        continue;
      }

      playersToSet.add(phoneCallMemberState[CLIENT_ID_STATE_NAME]);
    }

    this.clientModule.setPlayersCommType(Array.from(playersToSet), YacaFilterEnum.PHONE_SPEAKER, false);
    this.phoneCallMemberIds.delete(player);
  }
}
