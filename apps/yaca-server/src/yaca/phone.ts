import { PHONE_SPEAKER_STATE_NAME } from '@yaca-voice/common'
import { YacaFilterEnum } from '@yaca-voice/types'
import { triggerClientEvent } from '../utils/events'
import type { YaCAServerModule } from './main'

/**
 * The phone module for the server.
 */
export class YaCAServerPhoneModle {
    private serverModule: YaCAServerModule

    /**
     * Creates an instance of the phone module.
     *
     * @param {YaCAServerModule} serverModule - The server module.
     */
    constructor(serverModule: YaCAServerModule) {
        this.serverModule = serverModule

        this.registerEvents()
        this.registerExports()
    }

    /**
     * Register server events.
     */
    registerEvents() {
        /**
         * Handles the "server:yaca:phoneSpeakerEmitWhisper" event.
         *
         * @param {number[]} enableForTargets - The IDs of the players to enable the phone speaker for.
         * @param {number[]} disableForTargets - The IDs of the players to disable the phone speaker for.
         */
        onNet('server:yaca:phoneSpeakerEmitWhisper', (enableForTargets?: number[], disableForTargets?: number[]) => {
            const player = this.serverModule.players.get(source)
            if (!player) {
                return
            }

            for (const callTarget of player.voiceSettings.inCallWith) {
                const target = this.serverModule.players.get(callTarget)
                if (!target) {
                    continue
                }

                const enableFor = enableForTargets?.filter((targetID) => targetID !== callTarget)
                const disableFor = disableForTargets?.filter((targetID) => targetID !== callTarget)

                if (enableFor?.length) {
                    emitNet('client:yaca:playersToPhoneSpeakerEmitWhisper', callTarget, enableFor, true)
                }

                if (disableFor?.length) {
                    emitNet('client:yaca:playersToPhoneSpeakerEmitWhisper', callTarget, disableFor, false)
                }
            }
        })

        /**
         * Handles the "server:yaca:phoneEmit" event.
         *
         * @param {number[]} enableForTargets - The IDs of the players to enable the phone speaker for.
         * @param {number[]} disableForTargets - The IDs of the players to disable the phone speaker for.
         */
        onNet('server:yaca:phoneEmit', (enableForTargets?: number[], disableForTargets?: number[]) => {
            if (!this.serverModule.sharedConfig.phoneHearPlayersNearby) return

            const player = this.serverModule.players.get(source)
            if (!player) {
                return
            }

            if (enableForTargets?.length) {
                for (const callTarget of player.voiceSettings.inCallWith) {
                    const callTargetPlayer = this.serverModule.players.get(callTarget)
                    if (!callTargetPlayer) continue

                    const relayTargets: number[] = []
                    const relayClientIds: number[] = []

                    for (const targetID of enableForTargets) {
                        if (targetID === callTarget || callTargetPlayer.voiceSettings.inCallWith.has(targetID)) continue

                        const target = this.serverModule.players.get(targetID)
                        if (!target?.voicePlugin) continue

                        relayTargets.push(targetID)
                        relayClientIds.push(target.voicePlugin.clientId)
                    }

                    if (!relayClientIds.length) continue

                    for (const targetID of relayTargets) {
                        const map = player.voiceSettings.emittedPhoneSpeaker
                        const set = map.get(targetID) ?? new Set<number>()
                        set.add(callTarget)
                        map.set(targetID, set)
                    }

                    emitNet('client:yaca:phoneHearAround', callTarget, relayClientIds, true)

                    if (this.serverModule.serverConfig.useWhisper && callTargetPlayer.voicePlugin) {
                        triggerClientEvent('client:yaca:phoneHearAroundWhisper', relayTargets, [callTargetPlayer.voicePlugin.clientId], true)
                    }
                }
            }

            if (disableForTargets?.length) {
                this.dropPhoneHearAround(source, disableForTargets)
            }
        })
    }

    registerExports() {
        /**
         * Creates a phone call between two players.
         *
         * @param {number} src - The player who is making the call.
         * @param {number} target - The player who is being called.
         * @param {boolean} state - The state of the call.
         */
        exports('callPlayer', (src: number, target: number, state: boolean) => this.callPlayer(src, target, state))

        /**
         * Creates a phone call between two players with the old effect.
         *
         * @param {number} src - The player who is making the call.
         * @param {number} target - The player who is being called.
         * @param {boolean} state - The state of the call.
         */
        exports('callPlayerOldEffect', (src: number, target: number, state: boolean) => this.callPlayer(src, target, state, YacaFilterEnum.PHONE_HISTORICAL))

        /**
         * Mute a player during a phone call.
         *
         * @param {number} src - The source-id of the player to mute.
         * @param {boolean} state - The mute state.
         */
        exports('muteOnPhone', (src: number, state: boolean) => this.muteOnPhone(src, state))

        /**
         * Enable or disable the phone speaker for a player.
         *
         * @param {number} src - The source-id of the player to enable the phone speaker for.
         * @param {boolean} state - The state of the phone speaker.
         */
        exports('enablePhoneSpeaker', (src: number, state: boolean) => this.enablePhoneSpeaker(src, state))

        /**
         * Is player in a phone call.
         *
         * @param {number} src - The source-id of the player to check.
         */
        exports('isPlayerInCall', (src: number): [boolean, number[]] => {
            const player = this.serverModule.players.get(src)
            if (!player) {
                return [false, []]
            }

            return [player.voiceSettings.inCallWith.size > 0, [...player.voiceSettings.inCallWith]]
        })
    }

    /**
     * Whether any player still relays the given bystander into the call of the given member.
     *
     * @param {number} bystanderId - The player being relayed.
     * @param {number} callTarget - The call member he is relayed to.
     */
    private isPhoneHearAroundHeld(bystanderId: number, callTarget: number): boolean {
        for (const player of this.serverModule.players.values()) {
            if (player.voiceSettings.emittedPhoneSpeaker.get(bystanderId)?.has(callTarget)) return true
        }

        return false
    }

    /**
     * Drops the phone hear around relays of one emitter and tells both ends about it.
     *
     * Several emitters can hold the same (bystander, call member) pair - in a conference everybody in the call who
     * stands next to the bystander relays him to everybody else. On both ends that is one device, so the "off" is
     * only sent once the last emitter has given the pair up.
     *
     * @param {number} emitterId - The player whose relays are dropped.
     * @param {number[]} [bystanderIds] - Restrict to these bystanders, all of them when omitted.
     * @param {number[]} [callTargets] - Restrict to these call members, all of them when omitted.
     */
    dropPhoneHearAround(emitterId: number, bystanderIds?: number[], callTargets?: number[]) {
        const emitter = this.serverModule.players.get(emitterId)
        if (!emitter) return

        const emitted = emitter.voiceSettings.emittedPhoneSpeaker
        const droppedForMember = new Map<number, number[]>()

        for (const bystanderId of bystanderIds ?? [...emitted.keys()]) {
            const members = emitted.get(bystanderId)
            if (!members) continue

            for (const member of callTargets ?? [...members]) {
                if (!members.delete(member)) continue

                const bystanders = droppedForMember.get(member) ?? []
                bystanders.push(bystanderId)
                droppedForMember.set(member, bystanders)
            }

            if (!members.size) emitted.delete(bystanderId)
        }

        // after the bookkeeping above, so this emitter is not counted as still holding what he just gave up
        for (const [member, bystanders] of droppedForMember) {
            const memberPlayer = this.serverModule.players.get(member)
            if (!memberPlayer?.voicePlugin) continue

            const disableForTargets: number[] = []
            const disableClientIds: number[] = []

            for (const bystanderId of bystanders) {
                if (this.isPhoneHearAroundHeld(bystanderId, member)) continue

                const bystander = this.serverModule.players.get(bystanderId)
                if (!bystander?.voicePlugin) continue

                disableForTargets.push(bystanderId)
                disableClientIds.push(bystander.voicePlugin.clientId)
            }

            if (!disableClientIds.length) continue

            emitNet('client:yaca:phoneHearAround', member, disableClientIds, false)

            if (this.serverModule.serverConfig.useWhisper) {
                triggerClientEvent('client:yaca:phoneHearAroundWhisper', disableForTargets, [memberPlayer.voicePlugin.clientId], false)
            }
        }
    }

    /**
     * Resends the phone hear around relays of a player who just (re)connected to the voice plugin.
     *
     * The emitting client only ever sends the changes of its bystanders, so a player who lost his devices on a
     * plugin restart would stay deaf to them until the bystanders around the call happen to change.
     *
     * @param {number} src - The player who (re)connected.
     */
    reestablishPhoneHearAround(src: number) {
        if (!this.serverModule.sharedConfig.phoneHearPlayersNearby) return

        const player = this.serverModule.players.get(src)
        if (!player?.voicePlugin) return

        const bystanderClientIds = new Set<number>()
        const memberClientIds = new Set<number>()

        for (const emitter of this.serverModule.players.values()) {
            for (const [bystanderId, members] of emitter.voiceSettings.emittedPhoneSpeaker) {
                // the player hears the bystanders standing next to his call members
                if (members.has(src)) {
                    const bystander = this.serverModule.players.get(bystanderId)
                    if (bystander?.voicePlugin) bystanderClientIds.add(bystander.voicePlugin.clientId)
                    continue
                }

                // the player is the bystander himself and whispers into the calls he is relayed to
                if (bystanderId === src && this.serverModule.serverConfig.useWhisper) {
                    for (const member of members) {
                        const memberPlayer = this.serverModule.players.get(member)
                        if (memberPlayer?.voicePlugin) memberClientIds.add(memberPlayer.voicePlugin.clientId)
                    }
                }
            }
        }

        if (bystanderClientIds.size) {
            emitNet('client:yaca:phoneHearAround', src, [...bystanderClientIds], true)
        }

        if (memberClientIds.size) {
            emitNet('client:yaca:phoneHearAroundWhisper', src, [...memberClientIds], true)
        }
    }

    /**
     * Drops every phone hear around relay the given player takes part in, in any of the three roles.
     *
     * @param {number} playerId - The player leaving.
     */
    dropAllPhoneHearAround(playerId: number) {
        for (const emitterId of this.serverModule.players.keys()) {
            if (emitterId === playerId) {
                this.dropPhoneHearAround(emitterId)
                continue
            }

            this.dropPhoneHearAround(emitterId, [playerId])
            this.dropPhoneHearAround(emitterId, undefined, [playerId])
        }
    }

    /**
     * Call another player.
     *
     * @param {number} src - The player who is making the call.
     * @param {number} target - The player who is being called.
     * @param {boolean} state - The state of the call.
     * @param {YacaFilterEnum} filter - The filter to use for the call. Defaults to PHONE if not provided.
     */
    callPlayer(src: number, target: number, state: boolean, filter: YacaFilterEnum = YacaFilterEnum.PHONE) {
        const player = this.serverModule.getPlayer(src)
        const targetPlayer = this.serverModule.getPlayer(target)
        if (!player || !targetPlayer) {
            return
        }

        emitNet('client:yaca:phone', target, src, state, filter)
        emitNet('client:yaca:phone', src, target, state, filter)

        const playerState = Player(src).state
        const targetState = Player(target).state

        if (state) {
            player.voiceSettings.inCallWith.add(target)
            targetPlayer.voiceSettings.inCallWith.add(src)

            if (playerState[PHONE_SPEAKER_STATE_NAME]) {
                this.enablePhoneSpeaker(src, true)
            }

            if (targetState[PHONE_SPEAKER_STATE_NAME]) {
                this.enablePhoneSpeaker(target, true)
            }
        } else {
            this.muteOnPhone(src, false, true)
            this.muteOnPhone(target, false, true)

            player.voiceSettings.inCallWith.delete(target)
            targetPlayer.voiceSettings.inCallWith.delete(src)

            this.dropPhoneHearAround(src, undefined, [target])
            this.dropPhoneHearAround(target, undefined, [src])

            if (playerState[PHONE_SPEAKER_STATE_NAME]) {
                this.enablePhoneSpeaker(src, false)
            }

            if (targetState[PHONE_SPEAKER_STATE_NAME]) {
                this.enablePhoneSpeaker(target, false)
            }
        }

        emit('yaca:external:phoneCall', src, target, state, filter)
    }

    /**
     * Mute a player during a phone call.
     *
     * @param {number} src - The source-id of the player to mute.
     * @param {boolean} state - The mute state.
     * @param {boolean} [onCallStop=false] - Whether the call has stopped. Defaults to false if not provided.
     */
    muteOnPhone(src: number, state: boolean, onCallStop = false) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        player.voiceSettings.mutedOnPhone = state
        emitNet('client:yaca:phoneMute', -1, src, state, onCallStop)
        emit('yaca:external:phoneMute', src, state)
    }

    /**
     * Enable or disable the phone speaker for a player.
     *
     * @param {number} src - The source-id of the player to enable the phone speaker for.
     * @param {boolean} state - The state of the phone speaker.
     */
    enablePhoneSpeaker(src: number, state: boolean) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        const playerState = Player(src).state

        if (state && player.voiceSettings.inCallWith.size) {
            playerState.set(PHONE_SPEAKER_STATE_NAME, Array.from(player.voiceSettings.inCallWith), true)
            emit('yaca:external:phoneSpeaker', src, true)
        } else {
            playerState.set(PHONE_SPEAKER_STATE_NAME, null, true)
            emit('yaca:external:phoneSpeaker', src, false)
        }
    }
}
