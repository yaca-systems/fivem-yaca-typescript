import type { YaCAClientModule } from "yaca";
import { CommDeviceMode, YacaFilterEnum, type YacaPlayerData } from "types";
import { cache } from "../utils";

/**
 * The phone module for the client.
 */
export class YaCAClientPhoneModule {
  clientModule: YaCAClientModule;

  inCall = false;
  phoneSpeakerActive = false;

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
      const target = this.clientModule.getPlayerByID(targetID);
      if (!target) {
        return;
      }

      this.inCall = state;

      this.clientModule.setPlayersCommType(target, YacaFilterEnum.PHONE, state, undefined, undefined, CommDeviceMode.TRANSCEIVER, CommDeviceMode.TRANSCEIVER);
    });

    /**
     * Handles the "client:yaca:phoneOld" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet("client:yaca:phoneOld", (targetID: number, state: boolean) => {
      const target = this.clientModule.getPlayerByID(targetID);
      if (!target) {
        return;
      }

      this.inCall = state;

      this.clientModule.setPlayersCommType(
        target,
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
      const target = this.clientModule.getPlayerByID(targetID);
      if (!target) {
        return;
      }

      target.mutedOnPhone = state;

      if (onCallStop) {
        return;
      }

      if (this.clientModule.useWhisper && target.remoteID === cache.serverId) {
        this.clientModule.setPlayersCommType([], YacaFilterEnum.PHONE, !state, undefined, undefined, CommDeviceMode.SENDER);
      } else if (!this.clientModule.useWhisper) {
        if (state) {
          this.clientModule.setPlayersCommType(
            target,
            YacaFilterEnum.PHONE,
            false,
            undefined,
            undefined,
            CommDeviceMode.TRANSCEIVER,
            CommDeviceMode.TRANSCEIVER,
          );
        } else {
          this.clientModule.setPlayersCommType(
            target,
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

      const applyRemovePhoneSpeaker: Set<YacaPlayerData> = new Set();
      for (const playerID of playerIDs) {
        const player = this.clientModule.getPlayerByID(playerID);
        if (!player) {
          continue;
        }

        applyRemovePhoneSpeaker.add(player);
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
    AddStateBagChangeHandler("yaca:phoneSpeaker", "", (bagName: string, _: string, value: object, __: number, replicated: boolean) => {
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
      if (typeof value !== "undefined") {
        this.clientModule.setPlayerVariable(playerSource, "phoneCallMemberIds", Array.isArray(value) ? value : [value]);
      }
    });
  }

  /**
   * Removes the phone speaker effect from a player entity.
   *
   * @param {number} player - The player entity from which the phone speaker effect is to be removed.
   */
  removePhoneSpeakerFromEntity(player: number) {
    const entityData = this.clientModule.getPlayerByID(player);
    if (!entityData?.phoneCallMemberIds) {
      return;
    }

    const playersToSet = [];
    for (const phoneCallMemberId of entityData.phoneCallMemberIds) {
      const phoneCallMember = this.clientModule.getPlayerByID(phoneCallMemberId);
      if (!phoneCallMember) {
        continue;
      }

      playersToSet.push(phoneCallMember);
    }

    this.clientModule.setPlayersCommType(playersToSet, YacaFilterEnum.PHONE_SPEAKER, false);

    delete entityData.phoneCallMemberIds;
  }
}
