import { GLOBAL_ERROR_LEVEL_STATE_NAME, clamp, locale } from '@yaca-voice/common'
import { CommDeviceMode, YacaFilterEnum, YacaNotificationType, type YacaPlayerData, type YacaRadioSettings, YacaStereoMode } from '@yaca-voice/types'
import { cache, calculateDistanceVec3, registerRdrKeyBind, requestAnimDict } from '../utils'
import type { YaCAClientModule } from './main'

/**
 * The radio module for the client.
 */
export class YaCAClientRadioModule {
    clientModule: YaCAClientModule

    radioEnabled = false
    talkingInChannels = new Set<number>()
    radioChannelSettings = new Map<number, YacaRadioSettings>()
    radioInitialized = false
    activeRadioChannel = 1
    playersWithShortRange = new Map<number, string>()
    playersInRadioChannel = new Map<number, Set<number>>()

    radioOnCooldown = false
    radioTowerCalculation = new Map<number, CitizenTimer | null>()

    defaultRadioSettings: YacaRadioSettings = {
        frequency: '0',
        muted: false,
        volume: 1,
        stereo: YacaStereoMode.STEREO,
    }

    /**
     * Creates an instance of the radio module.
     *
     * @param clientModule - The client module.
     */
    constructor(clientModule: YaCAClientModule) {
        this.clientModule = clientModule

        this.registerExports()
        this.registerEvents()

        if (!this.clientModule.saltyChatBridge) {
            if (this.clientModule.isFiveM) {
                this.registerKeybinds()
            } else {
                this.registerRdrKeybinds()
            }
        }
    }

    /**
     * Registers the exports for the radio module.
     */
    registerExports() {
        /**
         * Enables or disables the radio system.
         *
         * @param {boolean} state - The state of the radio system.
         */
        exports('enableRadio', (state: boolean) => this.enableRadio(state))

        /**
         * Returns the state of the radio system.
         *
         * @returns {boolean} The state of the radio system.
         */
        exports('isRadioEnabled', () => this.radioEnabled)

        /**
         * Changes the radio frequency of the active channel.
         *
         * @param {string} frequency - The frequency to set.
         */
        exports('changeRadioFrequency', (frequency: string) => this.changeRadioFrequencyRaw(frequency))

        /**
         * Changes the radio frequency.
         *
         * @param {number} channel - The channel number.
         * @param {string} frequency - The frequency to set.
         */
        exports('changeRadioFrequencyRaw', (channel: number, frequency: string) => this.changeRadioFrequencyRaw(frequency, channel))

        /**
         * Returns the radio frequency of a channel.
         *
         * @param {number} channel - The channel number.
         * @returns {string} The frequency of the channel.
         */
        exports('getRadioFrequency', (channel: number) => this.getRadioFrequency(channel))

        /**
         * Mutes the active radio channel.
         */
        exports('muteRadioChannel', () => this.muteRadioChannel())

        /**
         * Exports the `muteRadioChannelRaw` function to the plugin.
         * This function mutes a radio channel.
         *
         * @param {number} channel - The channel number.
         */
        exports('muteRadioChannelRaw', (channel: number) => this.muteRadioChannelRaw(channel))

        /**
         * Returns the mute state of a radio channel.
         */
        exports('isRadioChannelMuted', (channel: number = this.activeRadioChannel) => this.isRadioChannelMuted(channel))

        /**
         * Exports the `changeActiveRadioChannel` function to the plugin.
         * This function changes the active radio channel.
         *
         * @param {number} channel - The new radio channel.
         */
        exports('changeActiveRadioChannel', (channel: number) => this.changeActiveRadioChannel(channel))

        /**
         * Exports the `getActiveRadioChannel` function to the plugin.
         * This function returns the active radio channel.
         *
         * @returns {number} The active radio channel.
         */
        exports('getActiveRadioChannel', () => this.activeRadioChannel)

        /**
         * Exports the `changeRadioChannelVolume` function to the plugin.
         * This function changes the volume of the active radio channel.
         *
         * @param {boolean} higher - Whether to increase the volume.
         */
        exports('changeRadioChannelVolume', (higher: boolean) => this.changeRadioChannelVolume(higher))

        /**
         * Exports the `changeRadioChannelVolumeRaw` function to the plugin.
         * This function changes the volume of a radio channel.
         *
         * @param {number} channel - The channel number.
         * @param {number} volume - The volume to set.
         */
        exports('changeRadioChannelVolumeRaw', (channel: number, volume: number) => this.changeRadioChannelVolumeRaw(volume, channel))

        /**
         * Returns the volume of a radio channel.
         *
         * @param {number} channel - The channel number.
         * @returns {number} The volume of the channel.
         */
        exports('getRadioChannelVolume', (channel: number) => this.getRadioChannelVolume(channel))

        /**
         * Exports the `changeRadioChannelStereo` function to the plugin.
         * This function changes the stereo mode for the active radio channel.
         */
        exports('changeRadioChannelStereo', () => this.changeRadioChannelStereo())

        /**
         * Exports the `changeRadioChannelStereoRaw` function to the plugin.
         * This function changes the stereo mode for a radio channel.
         *
         * @param {number} channel - The channel number.
         * @param {YacaStereoMode} stereo - The stereo mode to set.
         */
        exports('changeRadioChannelStereoRaw', (channel: number, stereo: YacaStereoMode) => this.changeRadioChannelStereoRaw(stereo, channel))

        /**
         * Returns the stereo mode of a radio channel.
         *
         * @param {number} channel - The channel number.
         * @returns {YacaStereoMode} The stereo mode of the channel.
         */
        exports('getRadioChannelStereo', (channel: number) => this.getRadioChannelStereo(channel))

        /**
         * Exports the `radioTalkingStart` function to the plugin.
         * This function starts the radio talking state.
         *
         * @param {boolean} state - The state of the radio talking.
         * @param {number} channel - The radio channel.
         * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
         */
        exports('radioTalkingStart', (state: boolean, channel: number, clearPedTasks = true) => this.radioTalkingStart(state, channel, clearPedTasks))
    }

    /**
     * Registers the events for the radio module.
     */
    registerEvents() {
        /**
         * Handles the "client:yaca:setRadioFreq" server event.
         *
         * @param {number} channel - The channel number.
         * @param {string} frequency - The frequency to set.
         */
        onNet('client:yaca:setRadioFreq', (channel: number, frequency: string) => {
            this.setRadioFrequency(channel, frequency)
        })

        /**
         * Handles the "client:yaca:radioTalking" server event.
         *
         * @param {number} target - The ID of the target.
         * @param {string} frequency - The frequency of the radio.
         * @param {boolean} state - The state of the radio talking.
         * @param {object[]} infos - The information about the radio.
         * @param {boolean} infos.shortRange - The state of the short range.
         * @param {boolean} self - The state of the player.
         */
        onNet(
            'client:yaca:radioTalking',
            (target: number, frequency: string, state: boolean, infos: { shortRange: boolean }[], self = false, senderDistanceToTower = -1) => {
                const channel = this.findRadioChannelByFrequency(frequency)
                if (!channel) {
                    return
                }

                const ownDistanceToTower = this.getNearestRadioTower()?.distance

                if (self) {
                    if (state && this.clientModule.sharedConfig.radioTowers.enabled && !ownDistanceToTower) return
                    this.radioTalkingStateToPluginWithWhisper(state, target, channel)
                    return
                }

                if (state && this.clientModule.sharedConfig.radioTowers.enabled && (!ownDistanceToTower || senderDistanceToTower === -1)) return

                const player = this.clientModule.getPlayerByID(target)
                if (!player) {
                    return
                }

                const info = infos[cache.serverId]

                if (!info?.shortRange || (info?.shortRange && GetPlayerFromServerId(target) !== -1)) {
                    let errorLevel: number | null = null

                    if (this.clientModule.sharedConfig.radioTowers.enabled && ownDistanceToTower) {
                        const ownSignalStrength = this.calculateSignalStrength(ownDistanceToTower)
                        const senderSignalStrength = this.calculateSignalStrength(senderDistanceToTower)
                        const globalSignalError = GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? 0

                        errorLevel = Math.max(ownSignalStrength, senderSignalStrength, globalSignalError)
                    }

                    this.clientModule.setPlayersCommType(
                        player,
                        YacaFilterEnum.RADIO,
                        state,
                        channel,
                        undefined,
                        CommDeviceMode.RECEIVER,
                        CommDeviceMode.SENDER,
                        errorLevel,
                    )
                }

                if (state) {
                    this.playersInRadioChannel.get(channel)?.add(target)
                    if (info?.shortRange) {
                        this.playersWithShortRange.set(target, frequency)
                    }

                    emit('yaca:external:isRadioReceiving', true, channel)
                    this.clientModule.saltyChatBridge?.handleRadioReceivingStateChange(true, channel)
                } else {
                    this.playersInRadioChannel.get(channel)?.delete(target)
                    if (info?.shortRange) {
                        this.playersWithShortRange.delete(target)
                    }

                    const inRadio = this.playersInRadioChannel.get(channel)?.size || 0
                    const state = inRadio > 0
                    emit('yaca:external:isRadioReceiving', state, channel)
                    this.clientModule.saltyChatBridge?.handleRadioReceivingStateChange(state, channel)
                }
            },
        )

        /**
         * Handles the "client:yaca:setRadioMuteState" server event.
         *
         * @param {number} channel - The channel number.
         * @param {boolean} state - The state of the radio mute.
         */
        onNet('client:yaca:setRadioMuteState', (channel: number, state: boolean) => {
            const channelSettings = this.radioChannelSettings.get(channel)

            if (!channelSettings) {
                return
            }

            channelSettings.muted = state
            emit('yaca:external:setRadioMuteState', channel, state)
            this.disableRadioFromPlayerInChannel(channel)
        })

        /**
         * Handles the "client:yaca:leaveRadioChannel" server event.
         *
         * @param {number | number[]} client_ids - The IDs of the clients.
         * @param {string} frequency - The frequency of the radio.
         */
        onNet('client:yaca:leaveRadioChannel', (client_ids: number | number[], frequency: string) => {
            if (!Array.isArray(client_ids)) {
                client_ids = [client_ids]
            }

            const channel = this.findRadioChannelByFrequency(frequency)
            if (!channel) {
                return
            }

            const playerData = this.clientModule.getPlayerByID(cache.serverId)
            if (!playerData || !playerData.clientId) {
                return
            }

            if (client_ids.includes(playerData.clientId)) {
                this.setRadioFrequency(channel, '0')
            }

            this.clientModule.sendWebsocket({
                base: { request_type: 'INGAME' },
                comm_device_left: {
                    comm_type: YacaFilterEnum.RADIO,
                    client_ids,
                    channel,
                },
            })
        })
    }

    /**
     * Registers the command and key mapping for the radio talking.
     */
    registerKeybinds() {
        if (this.clientModule.sharedConfig.keyBinds.radioTransmit === false) {
            return
        }

        /**
         * Registers the command and key mapping for the radio talking.
         */
        RegisterCommand(
            '+yaca:radioTalking',
            () => {
                this.radioTalkingStart(true, this.activeRadioChannel)
            },
            false,
        )
        RegisterCommand(
            '-yaca:radioTalking',
            () => {
                this.radioTalkingStart(false, this.activeRadioChannel)
            },
            false,
        )
        RegisterKeyMapping('+yaca:radioTalking', locale('use_radio'), 'keyboard', this.clientModule.sharedConfig.keyBinds.radioTransmit)
    }

    /**
     * Registers the keybindings for the radio talking.
     * This is only available in RedM.
     */
    registerRdrKeybinds() {
        if (this.clientModule.sharedConfig.keyBinds.radioTransmit === false) {
            return
        }

        registerRdrKeyBind(
            this.clientModule.sharedConfig.keyBinds.radioTransmit,
            () => {
                this.radioTalkingStart(true, this.activeRadioChannel)
            },
            () => {
                this.radioTalkingStart(false, this.activeRadioChannel)
            },
        )
    }

    /**
     * Enable or disable the radio system.
     *
     * @param {boolean} state - The state of the radio system.
     */
    enableRadio(state: boolean) {
        if (!this.clientModule.isPluginInitialized()) {
            return
        }

        if (this.radioEnabled !== state) {
            this.radioEnabled = state
            emitNet('server:yaca:enableRadio', state)

            if (!state) {
                for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
                    this.disableRadioFromPlayerInChannel(i)
                }
            }

            if (state && !this.radioInitialized) {
                this.radioInitialized = true
                this.initRadioSettings()
            }

            emit('yaca:external:isRadioEnabled', state)
        }
    }

    /**
     * Calculate the signal strength based on the distance.
     *
     * @param distance - The distance to the radio tower.
     * @param maxDistance - The maximum distance to the radio tower.
     *
     * @returns {number} The signal strength.
     */
    calculateSignalStrength(distance: number, maxDistance: number = this.clientModule.sharedConfig.radioTowers.maxDistance): number {
        const ratio = distance / maxDistance
        return clamp(Math.log10(1 + ratio * 8.5) / Math.log10(10), 0, 1)
    }

    /**
     * Finds the nearest tower to the local player.
     * Iterates through all towers and calculates the distance to the local player's position.
     * Keeps track of the nearest tower found during the iteration.
     *
     * @returns {object} An object containing the nearest tower and its distance, or null if no towers are present.
     */
    getNearestRadioTower() {
        let nearestTower: { distance: number; coords: [number, number, number] } | null = null

        const playerPos = GetEntityCoords(cache.ped, false)

        for (const coords of this.clientModule.sharedConfig.radioTowers.positions) {
            const distance = calculateDistanceVec3(playerPos, coords)
            if (distance >= this.clientModule.sharedConfig.radioTowers.maxDistance) {
                continue
            }

            if (!nearestTower || distance < nearestTower.distance) {
                nearestTower = { distance, coords }
            }
        }

        return nearestTower
    }

    /**
     * Change the radio frequency.
     *
     * @param {number} channel - The channel number.
     * @param {string} frequency - The frequency to set.
     */
    changeRadioFrequencyRaw(frequency: string, channel: number = this.activeRadioChannel) {
        if (!this.clientModule.isPluginInitialized()) {
            return
        }

        emitNet('server:yaca:changeRadioFrequency', channel, frequency)
    }

    /**
     * Get the radio frequency of a channel.
     *
     * @param channel - The channel number.
     * @returns {string} The frequency of the channel.
     */
    getRadioFrequency(channel: number = this.activeRadioChannel): string {
        const channelData = this.radioChannelSettings.get(channel)

        if (!channelData) {
            return '0'
        }

        return channelData.frequency
    }

    /**
     * Mute the active radio channel.
     */
    muteRadioChannel() {
        this.muteRadioChannelRaw()
    }

    /**
     * Mute a radio channel.
     *
     * @param {number} channel - The channel to mute. Defaults to the current active channel.
     */
    muteRadioChannelRaw(channel: number = this.activeRadioChannel) {
        if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
            return
        }

        const channelSettings = this.radioChannelSettings.get(channel)

        if (!channelSettings) {
            return
        }

        if (channelSettings.frequency === '0') {
            return
        }

        emitNet('server:yaca:muteRadioChannel', channel)
    }

    /**
     * Check if a radio channel is muted.
     *
     * @param channel - The channel number. Defaults to the active channel.
     * @returns {boolean} Whether the channel is muted. If the channel does not exist, it will return true.
     */
    isRadioChannelMuted(channel: number = this.activeRadioChannel): boolean {
        const channelData = this.radioChannelSettings.get(channel)

        if (!channelData) {
            return true
        }

        return channelData.muted
    }

    /**
     * Change the active radio channel.
     *
     * @param {number} channel - The new radio channel.
     * @returns {boolean} Whether the channel was changed.
     */
    changeActiveRadioChannel(channel: number): boolean {
        if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
            return false
        }

        emitNet('server:yaca:changeActiveRadioChannel', channel)
        emit('yaca:external:changedActiveRadioChannel', channel)
        this.activeRadioChannel = channel

        return true
    }

    /**
     * Change the volume of the active radio channel.
     *
     * @param {boolean} higher - Whether to increase the volume.
     * @returns {boolean} Whether the volume was changed.
     */
    changeRadioChannelVolume(higher: boolean): boolean {
        const channel = this.activeRadioChannel
        const radioSettings = this.radioChannelSettings.get(channel)

        if (!radioSettings) {
            return false
        }

        const oldVolume = radioSettings.volume
        return this.changeRadioChannelVolumeRaw(oldVolume + (higher ? 0.17 : -0.17), channel)
    }

    /**
     * Change the volume of a radio channel.
     *
     * @param {number} channel - The channel number. Defaults to the active channel.
     * @param {number} volume - The volume to set.
     * @returns {boolean} Whether the volume was changed.
     */
    changeRadioChannelVolumeRaw(volume: number, channel: number = this.activeRadioChannel): boolean {
        if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
            return false
        }

        const channelSettings = this.radioChannelSettings.get(channel)
        if (!channelSettings) {
            return false
        }

        const oldVolume = channelSettings.volume
        channelSettings.volume = clamp(volume, 0, 1)

        // Prevent event emit spams, if nothing changed
        if (oldVolume === channelSettings.volume) {
            return true
        }

        if (channelSettings.volume === 0 || (oldVolume === 0 && channelSettings.volume > 0)) {
            emitNet('server:yaca:muteRadioChannel', channel)
        }

        // Prevent duplicate update, cuz mute has its own update
        if (channelSettings.volume > 0) {
            emit('yaca:external:setRadioVolume', channel, channelSettings.volume)
        }

        // Send update to voice plugin
        this.clientModule.setCommDeviceVolume(YacaFilterEnum.RADIO, channelSettings.volume, channel)
        return true
    }

    /**
     * Get the volume of a radio channel.
     *
     * @param channel - The channel number. Defaults to the active channel.
     * @returns {number} The volume of the channel. If the channel does not exist, it will return 0.
     */
    getRadioChannelVolume(channel: number = this.activeRadioChannel): number {
        const channelData = this.radioChannelSettings.get(channel)

        if (!channelData) {
            return 0
        }

        return channelData.volume
    }

    /**
     * Change the stereo mode for the active radio channel.
     *
     * @param channel - The channel number. Defaults to the active channel.
     * @returns {boolean} Whether the stereo mode was changed.
     */
    changeRadioChannelStereo(channel: number = this.activeRadioChannel): boolean {
        const channelSettings = this.radioChannelSettings.get(channel)

        if (!channelSettings) {
            return false
        }

        switch (channelSettings.stereo) {
            case YacaStereoMode.STEREO:
                if (this.changeRadioChannelStereoRaw(YacaStereoMode.MONO_LEFT, channel)) {
                    this.clientModule.notification(locale('changed_stereo_mode', channel, locale('left_ear')), YacaNotificationType.INFO)
                    return true
                }
                break
            case YacaStereoMode.MONO_LEFT:
                if (this.changeRadioChannelStereoRaw(YacaStereoMode.MONO_RIGHT, channel)) {
                    this.clientModule.notification(locale('changed_stereo_mode', channel, locale('right_ear')), YacaNotificationType.INFO)
                    return true
                }
                break
            default:
                if (this.changeRadioChannelStereoRaw(YacaStereoMode.STEREO, channel)) {
                    this.clientModule.notification(locale('changed_stereo_mode', channel, locale('both_ears')), YacaNotificationType.INFO)
                    return true
                }
                break
        }

        return false
    }

    /**
     * Change the stereo mode for a radio channel.
     *
     * @param channel - The channel number. Defaults to the active channel.
     * @param stereo - The stereo mode to set.
     * @returns {boolean} Whether the stereo mode was changed.
     */
    changeRadioChannelStereoRaw(stereo: YacaStereoMode, channel: number = this.activeRadioChannel): boolean {
        if (!this.clientModule.isPluginInitialized() || !this.radioEnabled) {
            return false
        }

        const channelSettings = this.radioChannelSettings.get(channel)
        if (!channelSettings) {
            return false
        }

        channelSettings.stereo = stereo
        this.clientModule.setCommDeviceStereoMode(YacaFilterEnum.RADIO, stereo, channel)

        emit('yaca:external:setRadioChannelStereo', channel, stereo.toString())

        return true
    }

    /**
     * Get the stereo mode of a radio channel.
     *
     * @param channel - The channel number. Defaults to the active channel.
     * @returns {string} The stereo mode of the channel.
     */
    getRadioChannelStereo(channel: number = this.activeRadioChannel): string {
        const channelData = this.radioChannelSettings.get(channel)

        if (!channelData) {
            return YacaStereoMode.STEREO.toString()
        }

        return channelData.stereo.toString()
    }

    /**
     * Set volume & stereo mode for all radio channels on first start and reconnect.
     */
    initRadioSettings() {
        for (let i = 1; i <= this.clientModule.sharedConfig.maxRadioChannels; i++) {
            if (!this.radioChannelSettings.has(i)) {
                this.radioChannelSettings.set(i, {
                    ...this.defaultRadioSettings,
                })
            }
            if (!this.playersInRadioChannel.has(i)) {
                this.playersInRadioChannel.set(i, new Set())
            }

            const { volume, stereo, frequency } = this.radioChannelSettings.get(i) ?? this.defaultRadioSettings

            this.clientModule.setCommDeviceStereoMode(YacaFilterEnum.RADIO, stereo, i)
            this.clientModule.setCommDeviceVolume(YacaFilterEnum.RADIO, volume, i)

            if (frequency !== '0') {
                emitNet('server:yaca:changeRadioFrequency', i, frequency)
            }
        }
    }

    /**
     * Sends an event to the plugin when a player starts or stops talking on the radio.
     *
     * @param {boolean} state - The state of the player talking on the radio.
     * @param {number} channel - The channel number.
     */
    radioTalkingStateToPlugin(state: boolean, channel: number) {
        const player = this.clientModule.getPlayerByID(cache.serverId)

        if (!player) {
            return
        }

        this.clientModule.setPlayersCommType(player, YacaFilterEnum.RADIO, state, channel)
    }

    /**
     * Sends an event to the plugin when a player starts or stops talking on the radio with whisper.
     *
     * @param state - The state of the player talking on the radio.
     * @param targets - The IDs of the targets.
     * @param channel - The channel number.
     */
    radioTalkingStateToPluginWithWhisper(state: boolean, targets: number | number[], channel: number) {
        if (!Array.isArray(targets)) {
            targets = [targets]
        }

        const comDeviceTargets = []
        for (const target of targets) {
            const player = this.clientModule.getPlayerByID(target)
            if (!player) {
                continue
            }

            comDeviceTargets.push(player)
        }

        this.clientModule.setPlayersCommType(comDeviceTargets, YacaFilterEnum.RADIO, state, channel, undefined, CommDeviceMode.SENDER, CommDeviceMode.RECEIVER)
    }

    /**
     * Finds a radio channel by a given frequency.
     *
     * @param {string} frequency - The frequency to search for.
     * @returns {number | null} The channel number if found, null otherwise.
     */
    findRadioChannelByFrequency(frequency: string): number | null {
        for (const [channel, data] of this.radioChannelSettings) {
            if (data.frequency === frequency) {
                return channel
            }
        }

        return null
    }

    /**
     * Set the radio frequency.
     *
     * @param channel - The channel number.
     * @param frequency - The frequency to set.
     */
    setRadioFrequency(channel: number, frequency: string) {
        const channelSettings = this.radioChannelSettings.get(channel)
        if (!channelSettings) {
            return
        }

        if (channelSettings.frequency !== frequency) {
            this.disableRadioFromPlayerInChannel(channel)
        }

        channelSettings.frequency = frequency
        emit('yaca:external:setRadioFrequency', channel, frequency)

        // SaltyChat bridge
        if (this.clientModule.saltyChatBridge) {
            const saltyFrequency = channelSettings.frequency === '0' ? '' : channelSettings.frequency
            emit('SaltyChat_RadioChannelChanged', saltyFrequency, channel === 1)
        }
    }

    /**
     * Disable radio effect for all players in the given channel.
     *
     * @param {number} channel - The channel number.
     */
    disableRadioFromPlayerInChannel(channel: number) {
        const players = this.playersInRadioChannel.get(channel)
        if (!players || !players.size) {
            return
        }

        const targets: YacaPlayerData[] = []
        for (const playerId of players) {
            const player = this.clientModule.getPlayerByID(playerId)
            if (!player || !player.remoteID) {
                continue
            }

            targets.push(player)
            players.delete(player.remoteID)
        }

        if (targets.length) {
            this.clientModule.setPlayersCommType(targets, YacaFilterEnum.RADIO, false, channel, undefined, CommDeviceMode.RECEIVER, CommDeviceMode.SENDER)
        }
    }

    /**
     * Starts the radio talking state.
     *
     * @param {boolean} state - The state of the radio talking.
     * @param {number} channel - The radio channel.
     * @param {boolean} [clearPedTasks=true] - Whether to clear ped tasks. Defaults to true if not provided.
     */
    radioTalkingStart(state: boolean, channel: number, clearPedTasks = true) {
        if (!state) {
            if (this.talkingInChannels.has(channel)) {
                const interval = this.radioTowerCalculation.get(channel)
                if (interval) {
                    clearInterval(interval)
                    this.radioTowerCalculation.delete(channel)
                }

                this.talkingInChannels.delete(channel)
                if (!this.clientModule.useWhisper) {
                    this.radioTalkingStateToPlugin(false, channel)
                }

                this.clientModule.saltyChatBridge?.handleRadioTalkingStateChange(false, channel)

                emitNet('server:yaca:radioTalking', false, channel)
                emit('yaca:external:isRadioTalking', false, channel)

                if (clearPedTasks) {
                    StopAnimTask(cache.ped, 'random@arrests', 'generic_radio_chatter', 4)
                }
            }

            return
        }

        if (this.clientModule.sharedConfig.radioAntiSpamCooldown) {
            if (this.radioOnCooldown) {
                return
            }

            this.radioOnCooldown = true

            setTimeout(() => {
                this.radioOnCooldown = false
            }, this.clientModule.sharedConfig.radioAntiSpamCooldown)
        }

        const channelSettings = this.radioChannelSettings.get(channel)
        if (!this.radioEnabled || channelSettings?.frequency === '0' || this.talkingInChannels.has(channel)) {
            return
        }

        this.talkingInChannels.add(channel)
        if (!this.clientModule.useWhisper) {
            this.radioTalkingStateToPlugin(true, channel)
        }

        requestAnimDict('random@arrests').then(() => {
            TaskPlayAnim(cache.ped, 'random@arrests', 'generic_radio_chatter', 3, -4, -1, 49, 0.0, false, false, false)

            this.clientModule.saltyChatBridge?.handleRadioTalkingStateChange(true, channel)

            if (!this.radioTowerCalculation.has(channel)) {
                this.radioTowerCalculation.set(
                    channel,
                    setInterval(() => {
                        this.sendRadioRequestToServer(channel)
                    }, 1000),
                )
            }

            emitNet('server:yaca:radioTalking', true, channel)
            emit('yaca:external:isRadioTalking', true, channel)
        })
    }

    /**
     * Sends a radio request to the server and calculates the distance to the nearest radio tower.
     *
     * @param channel - The radio channel to send the request to.
     */
    sendRadioRequestToServer(channel: number) {
        const distanceToTower = this.getNearestRadioTower()?.distance ?? -1
        emitNet('server:yaca:radioTalking', true, channel, distanceToTower)
    }
}
