import { locale } from '@yaca-voice/common'
import { YacaNotificationType, type YacaServerConfig, type YacaSharedConfig } from '@yaca-voice/types'
import { triggerClientEvent } from '../utils/events'
import type { YaCAServerModule } from './main'

/**
 * The server-side radio module.
 */
export class YaCAServerRadioModule {
    private serverModule: YaCAServerModule
    private sharedConfig: YacaSharedConfig
    private serverConfig: YacaServerConfig

    radioFrequencyMap = new Map<string, Map<number, { muted: boolean }>>()

    securedRadioFrequencies: { start: string; end?: string }[] = []

    /**
     * Creates an instance of the radio module.
     *
     * @param {YaCAServerModule} serverModule - The server module.
     */
    constructor(serverModule: YaCAServerModule) {
        this.serverModule = serverModule
        this.sharedConfig = serverModule.sharedConfig
        this.serverConfig = serverModule.serverConfig

        this.registerEvents()
        this.registerExports()
    }

    /**
     * Register server events.
     */
    registerEvents() {
        /**
         * Handles the "server:yaca:enableRadio" server event.
         *
         * @param {boolean} state - The state of the radio.
         */
        onNet('server:yaca:enableRadio', (state: boolean) => {
            this.enableRadio(source, state)
        })

        /**
         * Handles the "server:yaca:changeRadioFrequency" server event.
         *
         * @param {number} channel - The channel to change the frequency of.
         * @param {string} frequency - The new frequency.
         */
        onNet('server:yaca:changeRadioFrequency', (channel: number, frequency: string) => {
            this.changeRadioFrequency(source, channel, frequency)
        })

        /**
         * Handles the "server:yaca:muteRadioChannel" server event.
         *
         * @param {number} channel - The channel to mute.
         */
        onNet('server:yaca:muteRadioChannel', (channel: number, state?: boolean) => {
            this.radioChannelMute(source, channel, state)
        })

        /**
         * Handles the "server:yaca:radioTalking" server event.
         *
         * @param {boolean} state - The state of the radio.
         * @param {number} channel - The channel to change the talking state for.
         * @param {number} distanceToTower - The distance to the tower.
         */
        onNet('server:yaca:radioTalking', (state: boolean, channel: number, distanceToTower = -1) => {
            this.radioTalkingState(source, state, channel, distanceToTower)
        })
    }

    /**
     * Register server exports.
     */
    registerExports() {
        /**
         * Get all players in a radio frequency.
         *
         * @param {string} frequency - The frequency to get the players for.
         * @returns {number[]} - The players in the radio frequency.
         */
        exports('getPlayersInRadioFrequency', (frequency: string) => this.getPlayersInRadioFrequency(frequency))

        /**
         * Set the radio channel for a player.
         *
         * @param {number} src - The player to set the radio channel for.
         * @param {number} channel - The channel to set.
         * @param {string} frequency - The frequency to set.
         */
        exports('setPlayerRadioChannel', (src: number, channel: number, frequency: string) => this.changeRadioFrequency(src, channel, frequency))

        /**
         * Get if a player has long range radio.
         *
         * @param {number} src - The player to set the long range radio for.
         */
        exports('getPlayerHasLongRange', (src: number) => this.getPlayerHasLongRange(src))

        /**
         * Set if a player has long range radio.
         *
         * @param {number} src - The player to set the long range radio for.
         * @param {boolean} state - The new state of the long range radio.
         */
        exports('setPlayerHasLongRange', (src: number, state: boolean) => this.setPlayerHasLongRange(src, state))

        /**
         * Set the secured radio frequency.
         *
         * @param {boolean} state - The new state of the secured radio frequency.
         * @param {string} start - The start frequency.
         * @param {string} [end] - The end frequency.
         */
        exports('setSecuredRadioFrequency', (state: boolean, start: string, end?: string) => this.setSecuredRadioFrequency(state, start, end))

        /**
         * Get the secured radio frequencies.
         *
         * @returns {Array<{ start: string, end?: string }>} - The secured radio frequencies.
         */
        exports('getSecuredRadioFrequencies', () => this.getSecuredRadioFrequencies())

        /**
         * Set the permitted radio frequencies for a player.
         *
         * @param {number} src - The player to set the permitted radio frequencies for.
         * @param {boolean} state - The new state of the permitted radio frequencies.
         * @param {string} start - The start frequency.
         * @param {string} [end] - The end frequency.
         */
        exports('setPermitRadioFrequency', (src: number, state: boolean, start: string, end?: string) => this.setPermitRadioFrequency(src, state, start, end))

        /**
         * Get the permitted radio frequencies for a player.
         *
         * @param {number} src - The player to get the permitted radio frequencies for.
         * @returns {Array<{ start: string, end?: string }>} - The permitted radio frequencies.
         */
        exports('getPermittedRadioFrequencies', (src: number) => this.getPermittedRadioFrequencies(src))
    }

    /**
     * Get all players in a radio frequency.
     *
     * @param frequency - The frequency to get the players for.
     */
    getPlayersInRadioFrequency(frequency: string) {
        const allPlayersInChannel = this.radioFrequencyMap.get(frequency)
        const playersArray: number[] = []

        if (!allPlayersInChannel) {
            return playersArray
        }

        for (const [key] of allPlayersInChannel) {
            const target = this.serverModule.getPlayer(key)
            if (!target) {
                continue
            }
            playersArray.push(key)
        }
        return playersArray
    }

    /**
     * Gets if a player has long range radio.
     *
     * @param src - The player to get the long range radio for.
     */
    getPlayerHasLongRange(src: number) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return false
        }

        return player.radioSettings.hasLong
    }

    /**
     * Sets if a player has long range radio.
     *
     * @param src - The player to set the long range radio for.
     * @param state - The new state of the long range radio.
     */
    setPlayerHasLongRange(src: number, state: boolean) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        player.radioSettings.hasLong = state
    }

    /**
     * Enable or disable the radio for a player.
     *
     * @param {number} src - The player to enable or disable the radio for.
     * @param {boolean} state - The new state of the radio.
     */
    enableRadio(src: number, state: boolean) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        player.radioSettings.activated = state

        emit('yaca:export:enabledRadio', src, state)
    }

    /**
     * Change the radio frequency for a player.
     *
     * @param {number} src - The player to change the radio frequency for.
     * @param {number} channel - The channel to change the frequency of.
     * @param {string} frequency - The new frequency.
     */
    changeRadioFrequency(src: number, channel: number, frequency: string) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        if (!player.radioSettings.activated) {
            emitNet('client:yaca:notification', src, locale('radio_not_activated'), YacaNotificationType.ERROR)
            return
        }

        if (Number.isNaN(channel) || channel < 1 || channel > this.sharedConfig.radioSettings.channelCount) {
            emitNet('client:yaca:notification', src, locale('radio_channel_invalid'), YacaNotificationType.ERROR)
            return
        }

        const oldFrequency = player.radioSettings.frequencies[channel]

        // Leave the old frequency if the new one is 0
        if (frequency === '0') {
            this.leaveRadioFrequency(src, channel, oldFrequency)
            return
        }

        // Leave the old frequency if it's different from the new one
        if (oldFrequency !== frequency) {
            this.leaveRadioFrequency(src, channel, oldFrequency)
        }

        // Check if the frequency is secured
        if (!this.hasAccessToRadioFrequency(src, frequency)) {
            return
        }

        // Add player to channel map, so we know who is in which channel
        if (!this.radioFrequencyMap.has(frequency)) {
            this.radioFrequencyMap.set(frequency, new Map<number, { muted: boolean }>())
        }
        this.radioFrequencyMap.get(frequency)?.set(src, { muted: false })

        player.radioSettings.frequencies[channel] = frequency

        emitNet('client:yaca:setRadioFreq', src, channel, frequency)
        emit('yaca:external:changedRadioFrequency', src, channel, frequency)
    }

    /**
     * Make a player leave a radio frequency.
     *
     * @param {number} src - The player to leave the radio frequency.
     * @param {number} channel - The channel to leave.
     * @param {string} frequency - The frequency to leave.
     */
    leaveRadioFrequency(src: number, channel: number, frequency: string) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        const allPlayersInChannel = this.radioFrequencyMap.get(frequency)
        if (!allPlayersInChannel) {
            return
        }

        player.radioSettings.frequencies[channel] = '0'

        const playersArray = []
        const allTargets = []
        for (const [key] of allPlayersInChannel) {
            const target = this.serverModule.getPlayer(key)
            if (!target) {
                continue
            }

            playersArray.push(key)

            if (key === src) {
                continue
            }

            allTargets.push(key)
        }

        if (this.serverConfig.useWhisper) {
            emitNet('client:yaca:radioTalking', src, allTargets, frequency, false, null, true)
        } else if (player.voicePlugin) {
            triggerClientEvent('client:yaca:leaveRadioChannel', playersArray, player.voicePlugin.clientId, frequency)
        }

        allPlayersInChannel.delete(src)
        if (!allPlayersInChannel.size) {
            this.radioFrequencyMap.delete(frequency)
        }
    }

    /**
     * Mute a radio channel for a player.
     *
     * @param {number} src - The player to mute the radio channel for.
     * @param {number} channel - The channel to mute.
     */
    radioChannelMute(src: number, channel: number, state?: boolean) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return
        }

        const radioFrequency = player.radioSettings.frequencies[channel]
        const foundPlayer = this.radioFrequencyMap.get(radioFrequency)?.get(src)
        if (!foundPlayer) {
            return
        }

        foundPlayer.muted = typeof state !== 'undefined' ? state : !foundPlayer.muted
        emitNet('client:yaca:setRadioMuteState', src, channel, foundPlayer.muted)
        emit('yaca:external:changedRadioMuteState', src, channel, foundPlayer.muted)
    }

    /**
     * Change the talking state of a player on the radio.
     *
     * @param {number} src - The player to change the talking state for.
     * @param {boolean} state - The new talking state.
     * @param {number} channel - The channel to change the talking state for.
     * @param {number} distanceToTower - The distance to the tower.
     */
    radioTalkingState(src: number, state: boolean, channel: number, distanceToTower: number) {
        const player = this.serverModule.getPlayer(src)
        if (!player || !player.radioSettings.activated) {
            return
        }

        const radioFrequency = player.radioSettings.frequencies[channel]
        if (!radioFrequency || radioFrequency === '0') {
            return
        }

        const getPlayers = this.radioFrequencyMap.get(radioFrequency)
        if (!getPlayers) {
            return
        }

        if (!this.hasAccessToRadioFrequency(src, radioFrequency)) {
            this.leaveRadioFrequency(src, channel, radioFrequency)
            return
        }

        let targets: number[] = []
        const targetsToSender: number[] = []
        const radioInfos: Record<number, { shortRange: boolean }> = {}

        for (const [key, values] of getPlayers) {
            if (values.muted) {
                if (key === src) {
                    targets = []
                    break
                }
                continue
            }

            if (key === src) {
                continue
            }

            const target = this.serverModule.getPlayer(key)
            if (!target || !target.radioSettings.activated) {
                continue
            }

            const shortRange = !player.radioSettings.hasLong && !target.radioSettings.hasLong
            if ((player.radioSettings.hasLong && target.radioSettings.hasLong) || shortRange) {
                targets.push(key)

                radioInfos[key] = {
                    shortRange,
                }

                targetsToSender.push(key)
            }
        }

        triggerClientEvent(
            'client:yaca:radioTalking',
            targets,
            src,
            radioFrequency,
            state,
            radioInfos,
            distanceToTower,
            GetEntityCoords(GetPlayerPed(src.toString())),
        )

        if (this.serverConfig.useWhisper) {
            emitNet('client:yaca:radioTalkingWhisper', src, targetsToSender, radioFrequency, state, GetEntityCoords(GetPlayerPed(src.toString())))
        }
    }

    /**
     * Sets or removes a secured radio frequency range.
     *
     * When enabling (`state` is `true`), adds the specified frequency range (`start` to `end`)
     * Then, removes all players from secured frequencies for which they do not have access.
     *
     * When disabling (`state` is `false`), removes the specified frequency range from the list
     * of secured radio frequencies.
     *
     * @param state - Whether to enable `true` or disable `false` the secured frequency range.
     * @param start - The start of the frequency range to secure.
     * @param end - The end of the frequency range to secure (optional).
     *
     * @returns A boolean indicating whether the operation was successful.
     */
    setSecuredRadioFrequency(state: boolean, start: string, end?: string) {
        const index = this.securedRadioFrequencies.findIndex((freq) => freq.start === start && freq.end === end)

        if (state && index === -1) {
            this.securedRadioFrequencies.push({ start: start, end: end })

            // Remove all players from frequency which are not permitted
            for (const [frequency, players] of this.radioFrequencyMap) {
                if (!this.isSecuredRadioFrequency(frequency)) continue

                for (const [src] of players) {
                    const player = this.serverModule.getPlayer(src)
                    if (!player) continue

                    if (!this.hasAccessToRadioFrequency(src, frequency, false)) {
                        const channel = Object.keys(player.radioSettings.frequencies).find((key) => player.radioSettings.frequencies[Number(key)] === frequency)
                        if (typeof channel === 'undefined') continue
                        this.leaveRadioFrequency(src, Number(channel), frequency)
                    }
                }
            }

            return true
        } else if (!state && index !== -1) {
            this.securedRadioFrequencies.splice(index, 1)

            return true
        }

        return false
    }

    /**
     * Returns the list of secured radio frequencies.
     *
     * @returns An array containing the secured radio frequencies.
     */
    getSecuredRadioFrequencies() {
        return this.securedRadioFrequencies
    }

    /**
     * Grants or revokes a player's permission to access a specific radio frequency range.
     *
     * @param src - The player identifier.
     * @param state - If `true`, grants permission; if `false`, revokes permission.
     * @param start - The starting frequency of the range.
     * @param end - The ending frequency of the range (optional).
     *
     * @returns A boolean indicating whether the operation was successful.
     */
    setPermitRadioFrequency(src: number, state: boolean, start: string, end?: string) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            return false
        }

        const index = player.radioSettings.permittedRadioFrequencies.findIndex((freq) => freq.start === start && freq.end === end)
        if (state && index === -1) {
            player.radioSettings.permittedRadioFrequencies.push({ start: start, end: end })

            return true
        } else if (!state && index !== -1) {
            player.radioSettings.permittedRadioFrequencies.splice(index, 1)

            for (const [channel, frequency] of Object.entries(player.radioSettings.frequencies)) {
                if (!this.hasAccessToRadioFrequency(src, frequency)) {
                    this.leaveRadioFrequency(src, Number(channel), frequency)
                }
            }

            return true
        }

        return false
    }

    /**
     * Retrieves the list of radio frequencies that the specified player is permitted to use.
     *
     * @param src - The source identifier of the player.
     * @returns An array of permitted radio frequencies for the player, or an empty array if none are set.
     */
    getPermittedRadioFrequencies(src: number) {
        const player = this.serverModule.getPlayer(src)
        return player?.radioSettings?.permittedRadioFrequencies ?? []
    }

    /**
     * Determines whether a given radio frequency is secured.
     *
     * Checks if the provided frequency matches any of the secured radio frequencies,
     * either as an exact value or within a specified range.
     *
     * @param frequency - The radio frequency to check, represented as a string.
     * @returns `true` if the frequency is secured; otherwise, `false`.
     */
    isSecuredRadioFrequency(frequency: string) {
        return this.securedRadioFrequencies.some((freq) => {
            const testFreq = this.parseRadioFrequencyAsFloat(frequency)
            const startFreq = this.parseRadioFrequencyAsFloat(freq.start)

            if (!freq.end) {
                return testFreq === startFreq
            }

            const endFreq = this.parseRadioFrequencyAsFloat(freq.end)
            const minFreq = Math.min(startFreq, endFreq)
            const maxFreq = Math.max(startFreq, endFreq)

            return testFreq >= minFreq && testFreq <= maxFreq
        })
    }

    /**
     * Parses a radio frequency string and returns its float representation.
     * Converts a comma (`,`) decimal separator to a dot (`.`) before parsing.
     *
     * @param frequency - The radio frequency as a string, which may use a comma or dot as the decimal separator.
     * @returns The parsed frequency as a number.
     */
    parseRadioFrequencyAsFloat(frequency: string): number {
        return parseFloat(frequency.replace(',', '.'))
    }

    /**
     * Checks whether a user has access to a specific radio frequency.
     *
     * If the frequency is not secured, access is always granted.
     * If the frequency is secured, verifies if the user is permitted to access it,
     * either as an exact match or within a permitted frequency range.
     *
     * @param src - The source identifier of the user requesting access.
     * @param frequency - The radio frequency to check access for.
     * @param notification - Whether to send a notification to the client if access is denied (default: true).
     * @returns `true` if the user has access to the frequency, otherwise `false`.
     */
    hasAccessToRadioFrequency(src: number, frequency: string, notification = true) {
        if (!this.isSecuredRadioFrequency(frequency)) {
            return true
        }

        const permittedFrequencies = this.getPermittedRadioFrequencies(src)
        if (permittedFrequencies.length === 0) {
            if (notification) {
                emitNet('client:yaca:notification', src, locale('radio_secured_channel'), YacaNotificationType.ERROR)
            }
            return false
        }

        const testFreq = this.parseRadioFrequencyAsFloat(frequency)

        for (const { start, end } of permittedFrequencies) {
            const startFreq = this.parseRadioFrequencyAsFloat(start)

            if (!end) {
                if (testFreq === startFreq) {
                    return true
                }
            } else {
                const endFreq = this.parseRadioFrequencyAsFloat(end)
                const minFreq = Math.min(startFreq, endFreq)
                const maxFreq = Math.max(startFreq, endFreq)

                if (testFreq >= minFreq && testFreq <= maxFreq) {
                    return true
                }
            }
        }

        if (notification) {
            emitNet('client:yaca:notification', src, locale('radio_secured_channel'), YacaNotificationType.ERROR)
        }

        return false
    }
}
