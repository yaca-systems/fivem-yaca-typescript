import { GLOBAL_ERROR_LEVEL_STATE_NAME, PHONE_SPEAKER_STATE_NAME } from '@yaca-voice/common'
import { CommDeviceMode, YacaFilterEnum, type YacaPlayerData } from '@yaca-voice/types'
import { cache } from '../utils'
import type { YaCAClientModule } from './main'

/**
 * The phone module for the client.
 */
export class YaCAClientPhoneModule {
  clientModule: YaCAClientModule

  inCallWith = new Set<number>()
  phoneSpeakerActive = false

  /**
   * Creates an instance of the phone module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule

    this.registerEvents()
    this.registerExports()
    this.registerStateBagHandlers()
  }

  registerEvents() {
    /**
     * Handles the "client:yaca:phone" server event.
     *
     * @param {number | number[]} targetIDs - The ID of the target.
     * @param {boolean} state - The state of the phone.
     */
    onNet('client:yaca:phone', (targetIDs: number | number[], state: boolean, filter: YacaFilterEnum = YacaFilterEnum.PHONE) => {
      if (!Array.isArray(targetIDs)) {
        targetIDs = [targetIDs]
      }

      this.enablePhoneCall(targetIDs, state, filter)
    })

    /**
     * Handles the "client:yaca:phoneHearAround" server event.
     *
     * @param {number[]} targetClientIds - The IDs of the targets.
     * @param {boolean} state - The state of the phone hear around.
     */
    onNet('client:yaca:phoneHearAround', (targetClientIds: number[], state: boolean) => {
      if (!targetClientIds.length) return

      const commTargets = Array.from(targetClientIds).map((clientId) => ({ clientId }))

      this.clientModule.setPlayersCommType(
        commTargets,
        YacaFilterEnum.PHONE,
        state,
        undefined,
        undefined,
        CommDeviceMode.TRANSCEIVER,
        CommDeviceMode.TRANSCEIVER,
        GlobalState[PHONE_SPEAKER_STATE_NAME] ?? undefined,
      )
    })

    /**
     * Handles the "client:yaca:phoneMute" server event.
     *
     * @param {number} targetID - The ID of the target.
     * @param {boolean} state - The state of the phone mute.
     * @param {boolean} onCallStop - The state of the call.
     */
    onNet('client:yaca:phoneMute', (targetID: number, state: boolean, onCallStop = false) => {
      const target = this.clientModule.getPlayerByID(targetID)
      if (!target) {
        return
      }

      target.mutedOnPhone = state

      if (onCallStop) {
        return
      }

      if (this.clientModule.useWhisper && target.remoteID === cache.serverId) {
        this.clientModule.setPlayersCommType([], YacaFilterEnum.PHONE, !state, undefined, undefined, CommDeviceMode.SENDER)
      } else if (!this.clientModule.useWhisper && this.inCallWith.has(targetID)) {
        this.clientModule.setPlayersCommType(target, YacaFilterEnum.PHONE, state, undefined, undefined, CommDeviceMode.TRANSCEIVER, CommDeviceMode.TRANSCEIVER)
      }
    })

    /**
     * Handles the "client:yaca:phoneSpeaker" server event.
     *
     * @param {number | number[]} playerIDs - The IDs of the players to be added or removed from the phone speaker.
     * @param {boolean} state - The state indicating whether to add or remove the players.
     */
    onNet('client:yaca:playersToPhoneSpeakerEmitWhisper', (playerIDs: number | number[], state: boolean) => {
      if (!this.clientModule.useWhisper) return

      if (!Array.isArray(playerIDs)) {
        playerIDs = [playerIDs]
      }

      const targets = new Set<YacaPlayerData>()
      for (const playerID of playerIDs) {
        const player = this.clientModule.getPlayerByID(playerID)
        if (!player) {
          continue
        }

        targets.add(player)
      }

      if (targets.size < 1) {
        return
      }

      this.clientModule.setPlayersCommType(
        Array.from(targets),
        YacaFilterEnum.PHONE_SPEAKER,
        state,
        undefined,
        undefined,
        CommDeviceMode.SENDER,
        CommDeviceMode.RECEIVER,
      )
    })
  }

  registerExports() {
    /**
     * Exports the "isInCall" function.
     * This function returns whether the player is in a phone call.
     *
     * @returns {boolean} - Whether the player is in a phone call.
     */
    exports('isInCall', () => this.inCallWith.size > 0)
  }

  registerStateBagHandlers() {
    /**
     * Handles the "yaca:phone" state bag change.
     */
    AddStateBagChangeHandler(PHONE_SPEAKER_STATE_NAME, '', (bagName: string, _: string, value: number | number[] | null) => {
      const playerId = GetPlayerFromStateBagName(bagName)
      if (playerId === 0) {
        return
      }

      const playerSource = GetPlayerServerId(playerId)
      if (playerSource === 0) {
        return
      }

      if (playerSource === cache.serverId) {
        this.phoneSpeakerActive = value !== null
      }

      this.removePhoneSpeakerFromEntity(playerSource)
      if (value !== null) {
        this.clientModule.setPlayerVariable(playerSource, 'phoneCallMemberIds', Array.isArray(value) ? value : [value])
      }
    })
  }

  /**
   * Removes the phone speaker effect from a player entity.
   *
   * @param {number} player - The player entity from which the phone speaker effect is to be removed.
   */
  removePhoneSpeakerFromEntity(player: number) {
    const entityData = this.clientModule.getPlayerByID(player)
    if (!entityData?.phoneCallMemberIds) {
      return
    }

    const playersToSet = []
    for (const phoneCallMemberId of entityData.phoneCallMemberIds) {
      const phoneCallMember = this.clientModule.getPlayerByID(phoneCallMemberId)
      if (!phoneCallMember) {
        continue
      }

      playersToSet.push(phoneCallMember)
    }

    this.clientModule.setPlayersCommType(
      playersToSet,
      YacaFilterEnum.PHONE_SPEAKER,
      false,
      undefined,
      undefined,
      CommDeviceMode.RECEIVER,
      CommDeviceMode.SENDER,
    )

    entityData.phoneCallMemberIds = undefined
  }

  /**
   * Handles the disconnection of a player from a phone call.
   *
   * @param {number} targetID - The ID of the target.
   */
  handleDisconnect(targetID: number) {
    this.inCallWith.delete(targetID)
  }

  /**
   * Reestablishes a phone call with a target, when a player has restarted the voice plugin.
   *
   * @param {number | number[]} targetIDs - The IDs of the targets.
   */
  reestablishCalls(targetIDs: number | number[]) {
    if (!this.inCallWith.size) {
      return
    }

    if (!Array.isArray(targetIDs)) {
      targetIDs = [targetIDs]
    }

    if (!targetIDs.length) {
      return
    }

    const targetsToReestablish = []
    for (const targetId of targetIDs) {
      if (this.inCallWith.has(targetId)) {
        targetsToReestablish.push(targetId)
      }
    }

    if (targetsToReestablish.length) {
      this.enablePhoneCall(targetsToReestablish, true, YacaFilterEnum.PHONE)
    }
  }

  /**
   * Enables or disables a phone call.
   *
   * @param {number[]} targetIDs - The IDs of the targets.
   * @param {boolean} state - The state of the phone call.
   * @param {YacaFilterEnum} filter - The filter to use.
   */
  enablePhoneCall(targetIDs: number[], state: boolean, filter: YacaFilterEnum = YacaFilterEnum.PHONE) {
    if (!targetIDs.length) {
      return
    }

    const commTargets = []
    for (const targetID of targetIDs) {
      const target = this.clientModule.getPlayerByID(targetID)
      if (!target) {
        if (!state) this.inCallWith.delete(targetID)
        continue
      }

      if (state) {
        this.inCallWith.add(targetID)
      } else {
        this.inCallWith.delete(targetID)
      }

      commTargets.push(target)
    }

    this.clientModule.setPlayersCommType(
      commTargets,
      filter,
      state,
      undefined,
      undefined,
      state || (!state && this.inCallWith.size) ? CommDeviceMode.TRANSCEIVER : undefined,
      CommDeviceMode.TRANSCEIVER,
      GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? undefined,
    )
  }
}
