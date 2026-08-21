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
    phoneHearAroundWhisperTargets = new Set<number>()
    phoneSpeakerWhisperTargets = new Set<number>()

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

            const ownClientId = this.clientModule.getPlayerByID(cache.serverId)?.clientId
            const commTargets = targetClientIds.filter((clientId) => clientId !== ownClientId).map((clientId) => ({ clientId }))

            if (!commTargets.length) return

            this.clientModule.setPlayersCommType(
                commTargets,
                YacaFilterEnum.PHONE,
                state,
                undefined,
                undefined,
                undefined,
                CommDeviceMode.TRANSCEIVER,
                GlobalState[PHONE_SPEAKER_STATE_NAME] ?? undefined,
            )
        })

        /**
         * Handles the "client:yaca:phoneHearAroundWhisper" server event.
         *
         * @param {number[]} callMemberClientIds - The client IDs of the call members to be heard by this player.
         * @param {boolean} state - The state of the phone hear around.
         */
        onNet('client:yaca:phoneHearAroundWhisper', (callMemberClientIds: number[], state: boolean) => {
            if (!this.clientModule.useWhisper || !callMemberClientIds.length) return

            const ownClientId = this.clientModule.getPlayerByID(cache.serverId)?.clientId
            const commTargets = callMemberClientIds.filter((clientId) => clientId !== ownClientId).map((clientId) => ({ clientId }))

            if (!commTargets.length) return

            for (const commTarget of commTargets) {
                if (state) {
                    this.phoneHearAroundWhisperTargets.add(commTarget.clientId)
                } else {
                    this.phoneHearAroundWhisperTargets.delete(commTarget.clientId)
                }
            }

            const ownMode = state || !this.phoneHearAroundWhisperTargets.size ? CommDeviceMode.SENDER : undefined

            this.clientModule.setPlayersCommType(commTargets, YacaFilterEnum.PHONE, state, undefined, undefined, ownMode, CommDeviceMode.RECEIVER)
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
                this.clientModule.setPlayersCommType([], YacaFilterEnum.PHONE, !state, undefined, undefined, CommDeviceMode.TRANSCEIVER)

                if (this.phoneSpeakerWhisperTargets.size) {
                    this.clientModule.setPlayersCommType([], YacaFilterEnum.PHONE_SPEAKER, !state, undefined, undefined, CommDeviceMode.SENDER)
                }
            } else if (!this.clientModule.useWhisper && this.inCallWith.has(targetID)) {
                this.clientModule.setPlayersCommType(
                    target,
                    YacaFilterEnum.PHONE,
                    !state,
                    undefined,
                    undefined,
                    CommDeviceMode.TRANSCEIVER,
                    CommDeviceMode.TRANSCEIVER,
                )
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

            for (const target of targets) {
                if (state) {
                    this.phoneSpeakerWhisperTargets.add(target.clientId)
                } else {
                    this.phoneSpeakerWhisperTargets.delete(target.clientId)
                }
            }

            this.clientModule.setPlayersCommType(
                Array.from(targets),
                YacaFilterEnum.PHONE_SPEAKER,
                state,
                undefined,
                undefined,
                this.ownPhoneSpeakerMode(state),
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
     * The own SENDER role on the phone speaker device.
     *
     * It is one membership for every bystander at once, so it is only given up together with the last of them - and
     * it is not claimed at all while muted on the phone, or the next bystander arriving at the other end would hand
     * the muted player his voice back.
     *
     * @param {boolean} state - Whether the bystanders in this message are being added or removed.
     */
    private ownPhoneSpeakerMode(state: boolean): CommDeviceMode | undefined {
        if (this.clientModule.getPlayerByID(cache.serverId)?.mutedOnPhone) {
            return undefined
        }

        return state || !this.phoneSpeakerWhisperTargets.size ? CommDeviceMode.SENDER : undefined
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
     * The whisper target sets are keyed by teamspeak client id and are only ever
     * maintained by the paired on/off events from the server - a player who drops out
     * sends no "off", so his entry stays. That is not a cosmetic leak: the size of
     * these sets decides whether our *own* membership is ever given up (see
     * ownPhoneSpeakerMode and the phoneHearAround branch), so one stale entry leaves us
     * holding an unlimited sender device for the rest of the session, whispering at
     * everyone who will take it.
     *
     * @param {number} targetID - The remote ID of the target.
     * @param {number} [clientId] - The target's teamspeak client id, if it is still
     *                              resolvable. Must be read before the player is
     *                              dropped from allPlayers.
     */
    handleDisconnect(targetID: number, clientId?: number) {
        this.inCallWith.delete(targetID)

        if (typeof clientId === 'number') {
            this.phoneSpeakerWhisperTargets.delete(clientId)
            this.phoneHearAroundWhisperTargets.delete(clientId)
        }
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

        // one membership for every call at once, so it is only given up with the last one - and not claimed again
        // while muted, or joining a further call would hand the muted player his voice back
        const mutedOnPhone = this.clientModule.getPlayerByID(cache.serverId)?.mutedOnPhone
        const ownMode = (state && mutedOnPhone) || (!state && this.inCallWith.size) ? undefined : CommDeviceMode.TRANSCEIVER

        this.clientModule.setPlayersCommType(
            commTargets,
            filter,
            state,
            undefined,
            undefined,
            ownMode,
            CommDeviceMode.TRANSCEIVER,
            GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? undefined,
        )
    }
}
