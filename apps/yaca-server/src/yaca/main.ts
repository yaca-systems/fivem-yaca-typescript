import {
    clamp,
    GLOBAL_ERROR_LEVEL_STATE_NAME,
    getGlobalErrorLevel,
    initLocale,
    loadConfig,
    locale,
    setGlobalErrorLevel,
    VOICE_RANGE_STATE_NAME,
} from '@yaca-voice/common'
import {
    type DataObject,
    defaultServerConfig,
    defaultSharedConfig,
    defaultTowerConfig,
    type ServerCache,
    type YacaMicrophoneSettings,
    type YacaServerConfig,
    type YacaSharedConfig,
    type YacaTowerConfig,
} from '@yaca-voice/types'
import { YaCAServerSaltyChatBridge } from '../bridge/saltychat'
import { checkVersion, generateRandomName } from '../utils'
import { YaCAServerMegaphoneModule } from './megaphone'
import { YaCAServerPhoneModle } from './phone'
import { YaCAServerRadioModule } from './radio'

/**
 * The player data type for YaCA.
 */
export type YaCAPlayer = {
    voiceSettings: {
        voiceFirstConnect: boolean
        forceMuted: boolean
        ingameName: string
        mutedOnPhone: boolean
        inCallWith: Set<number>
        emittedPhoneSpeaker: Map<number, Set<number>>
        tsUniqueIdentifier?: string
        volumeModifier?: number
        microphone?: YacaMicrophoneSettings
    }
    radioSettings: {
        activated: boolean
        hasLong: boolean
        frequencies: Record<number, string>
        permittedRadioFrequencies: { start: string; end?: string }[]
    }
    voicePlugin?: {
        playerId: number
        clientId: number
        forceMuted: boolean
        mutedOnPhone: boolean
        volumeModifier?: number
    }
}

/**
 * The main server module for YaCA.
 */
export class YaCAServerModule {
    cache: ServerCache | undefined

    nameSet: Set<string> = new Set()
    players: Map<number, YaCAPlayer> = new Map()

    defaultVoiceRange: number

    serverConfig: YacaServerConfig
    sharedConfig: YacaSharedConfig
    towerConfig: YacaTowerConfig

    phoneModule: YaCAServerPhoneModle
    radioModule: YaCAServerRadioModule
    megaphoneModule: YaCAServerMegaphoneModule

    saltChatBridge?: YaCAServerSaltyChatBridge

    /**
     * Creates an instance of the server module.
     */
    constructor() {
        console.log('~g~ --> YaCA: Server loaded')

        this.serverConfig = loadConfig<YacaServerConfig>('config/server.json5', defaultServerConfig)
        this.sharedConfig = loadConfig<YacaSharedConfig>('config/shared.json5', defaultSharedConfig)
        this.towerConfig = loadConfig<YacaTowerConfig>('config/tower.json5', defaultTowerConfig)

        initLocale(this.sharedConfig.locale)

        if (this.sharedConfig.voiceRange.ranges[this.sharedConfig.voiceRange.defaultIndex]) {
            this.defaultVoiceRange = this.sharedConfig.voiceRange.ranges[this.sharedConfig.voiceRange.defaultIndex]
        } else {
            this.defaultVoiceRange = 1
            this.sharedConfig.voiceRange.ranges = [1]

            console.error('[YaCA] Default voice range is not set correctly in the config.')
        }

        this.phoneModule = new YaCAServerPhoneModle(this)
        this.radioModule = new YaCAServerRadioModule(this)
        this.megaphoneModule = new YaCAServerMegaphoneModule(this)

        this.registerExports()
        this.registerEvents()

        if (this.sharedConfig.saltyChatBridge) {
            this.saltChatBridge = new YaCAServerSaltyChatBridge(this)
        }

        if (this.sharedConfig.versionCheck) {
            checkVersion().then()
        }

        GlobalState.set(GLOBAL_ERROR_LEVEL_STATE_NAME, 0, true)
    }

    /**
     * Get the player data for a specific player.
     */
    getPlayer(playerId: number): YaCAPlayer | undefined {
        return this.players.get(playerId)
    }

    /**
     * Initialize the player on first connect.
     *
     * @param {number} src - The source-id of the player to initialize.
     */
    connectToVoice(src: number) {
        const name = generateRandomName(src, this.nameSet, this.serverConfig.userNamePattern)
        if (!name) {
            DropPlayer(src.toString(), '[YaCA] Failed to generate a random name.')
            return
        }

        const playerState = Player(src).state
        playerState.set(VOICE_RANGE_STATE_NAME, this.defaultVoiceRange, true)

        this.players.set(src, {
            voiceSettings: {
                voiceFirstConnect: false,
                forceMuted: false,
                ingameName: name,
                mutedOnPhone: false,
                inCallWith: new Set<number>(),
                emittedPhoneSpeaker: new Map<number, Set<number>>(),
            },
            radioSettings: {
                activated: false,
                hasLong: true,
                frequencies: {},
                permittedRadioFrequencies: [],
            },
        })

        this.connect(src)
    }

    /**
     * Register all exports for the YaCA module.
     */
    registerExports() {
        exports('connectToVoice', (src: number) => this.connectToVoice(src))
        /**
         * Get the alive status of a player.
         *
         * @param {number} playerId - The ID of the player to get the alive status for.
         * @returns {boolean} - The alive status of the player.
         */
        exports('getPlayerAliveStatus', (playerId: number) => this.getPlayerAliveStatus(playerId))

        /**
         * Set the alive status of a player.
         *
         * @param {number} playerId - The ID of the player to set the alive status for.
         * @param {boolean} state - The new alive status.
         */
        exports('setPlayerAliveStatus', (playerId: number, state: boolean) => this.changePlayerAliveStatus(playerId, state))

        /**
         * Get the voice range of a player.
         *
         * @param {number} playerId - The ID of the player to get the voice range for.
         * @returns {number} - The voice range of the player.
         */
        exports('getPlayerVoiceRange', (playerId: number) => this.getPlayerVoiceRange(playerId))

        /**
         * Set the voice range of a player.
         *
         * @param {number} playerId - The ID of the player to set the voice range for.
         */
        exports('setPlayerVoiceRange', (playerId: number, range: number) => this.changeVoiceRange(playerId, range))

        /**
         * Set the global error level.
         *
         * @param {number} errorLevel - The new error level. Between 0 and 1.
         */
        exports('setGlobalErrorLevel', (errorLevel: number) => setGlobalErrorLevel(errorLevel))

        /**
         * Get the global error level.
         *
         * @returns {number} - The global error level.
         */
        exports('getGlobalErrorLevel', () => getGlobalErrorLevel())

        /**
         * Returns the TeamSpeak client unique identifier of a player.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {string} - The unique identifier or an empty string if it is not known yet.
         */
        exports('getPlayerTeamSpeakUniqueIdentifier', (playerId: number) => this.getPlayer(playerId)?.voiceSettings.tsUniqueIdentifier ?? '')

        /**
         * Set a temporary volume factor for a player, e.g. for a whisper or shout system.
         *
         * @param {number} playerId - The ID of the player the volume factor applies to.
         * @param {number} volumeModifier - The volume factor, clamped to 0.1 - 2.0 on the client. 1.0 resets it.
         */
        exports('setPlayerVolumeModifier', (playerId: number, volumeModifier: number) => this.setPlayerVolumeModifier(playerId, volumeModifier))

        /**
         * Get the temporary volume factor of a player.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {number} - The volume factor, 1.0 if none is set.
         */
        exports('getPlayerVolumeModifier', (playerId: number) => this.getPlayer(playerId)?.voiceSettings.volumeModifier ?? 1)

        /**
         * Turn a microphone on or off for a player, e.g. when they step up to a PA microphone on a stage.
         *
         * @param {number} playerId - The ID of the player at the microphone.
         * @param {boolean} state - Whether the microphone is turned on or off.
         * @param {YacaMicrophoneSettings} settings - The loudspeakers, their room and the range. Optional. Calling
         *                                           again while on updates them for a running microphone.
         */
        exports('setPlayerMicrophone', (playerId: number, state: boolean, settings?: YacaMicrophoneSettings) => {
            this.setPlayerMicrophone(playerId, state, settings)
        })

        /**
         * Get the active microphone of a player.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {YacaMicrophoneSettings | false} - The settings of the running microphone, false if none is on.
         */
        exports('getPlayerMicrophone', (playerId: number) => this.getPlayer(playerId)?.voiceSettings.microphone ?? false)

        /**
         * Returns the ingame name of a player.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {string} - The ingame name or an empty string if not found.
         */
        exports('getPlayerIngameName', (playerId: number) => {
            const player = this.getPlayer(playerId)
            if (!player) {
                console.error(locale('player_not_found', playerId))
                return ''
            }
            if (!player.voiceSettings?.ingameName) {
                console.error(locale('ingamename_not_set', playerId))
                return ''
            }
            return player.voiceSettings.ingameName
        })
    }

    /**
     * Register all events for the YaCA module.
     */
    registerEvents() {
        // FiveM: player dropped
        on('playerDropped', (_reason: string) => {
            this.handlePlayerDisconnect(source)
        })

        // YaCA: connect to voice when NUI is ready
        onNet('server:yaca:nuiReady', () => {
            if (!this.sharedConfig.autoConnectOnJoin) return
            this.connectToVoice(source)
        })

        // YaCA:successful voice connection and client-id sync
        onNet('server:yaca:addPlayer', (clientId: number, tsUniqueIdentifier?: string) => {
            this.addNewPlayer(source, clientId, tsUniqueIdentifier)
        })

        // YaCa: voice restart
        onNet('server:yaca:wsReady', () => {
            this.playerReconnect(source)
        })

        // TxAdmin: spectate stop event
        onNet('txsv:req:spectate:end', () => {
            emitNet('client:yaca:txadmin:stopspectate', source)
        })
    }

    /**
     * Handle various cases if player disconnects.
     *
     * @param {number} src - The source-id of the player who disconnected.
     */
    handlePlayerDisconnect(src: number) {
        const player = this.players.get(src)
        if (!player) {
            return
        }

        this.nameSet.delete(player.voiceSettings?.ingameName)

        const allFrequencies = this.radioModule.radioFrequencyMap
        for (const [key, value] of allFrequencies) {
            value.delete(src)
            if (!value.size) {
                this.radioModule.radioFrequencyMap.delete(key)
            }
        }

        this.phoneModule.dropAllPhoneHearAround(src)

        if (player.voiceSettings.microphone) {
            emitNet('client:yaca:microphone', -1, src, false)
        }

        emitNet('client:yaca:disconnect', -1, src)

        this.players.delete(src)
    }

    /**
     * Syncs player alive status and mute him if he is dead or whatever.
     *
     * @param {number} src - The source-id of the player to sync.
     * @param {boolean} alive - The new alive status.
     */
    changePlayerAliveStatus(src: number, alive: boolean) {
        const player = this.players.get(src)
        if (!player) {
            return
        }

        player.voiceSettings.forceMuted = !alive
        emitNet('client:yaca:muteTarget', -1, src, !alive)

        if (player.voicePlugin) {
            player.voicePlugin.forceMuted = !alive
        }
    }

    /**
     * Set a temporary volume factor for a player, e.g. for a whisper or shout system.
     *
     * The factor is kept server side so it can be replayed to players who connect later, the same way the mute state
     * is. The live event only reaches the players who are already connected.
     *
     * @param {number} src - The source-id of the player the volume factor applies to.
     * @param {number} volumeModifier - The volume factor, clamped to 0.1 - 2.0. 1.0 resets it.
     */
    setPlayerVolumeModifier(src: number, volumeModifier: number) {
        const player = this.players.get(src)
        if (!player) {
            console.error(locale('player_not_found', src))
            return
        }

        if (typeof volumeModifier !== 'number' || Number.isNaN(volumeModifier)) {
            console.error(`[YaCA] Invalid volume modifier for player ${src}: ${volumeModifier}`)
            return
        }

        const clampedModifier = clamp(volumeModifier, 0.1, 2)

        player.voiceSettings.volumeModifier = clampedModifier

        if (player.voicePlugin) {
            player.voicePlugin.volumeModifier = clampedModifier
        }

        emitNet('client:yaca:setPlayerVolumeModifier', -1, src, clampedModifier)
    }

    /**
     * Turn a microphone on or off for a player, e.g. when they step up to a PA microphone on a stage.
     *
     * The state is kept server side so it can be replayed to players who connect later, and so the microphone can be
     * turned off for everyone when the player disconnects.
     *
     * @param {number} src - The source-id of the player at the microphone.
     * @param {boolean} state - Whether the microphone is turned on or off.
     * @param {YacaMicrophoneSettings} settings - The loudspeakers, their room and the range. Optional.
     */
    setPlayerMicrophone(src: number, state: boolean, settings?: YacaMicrophoneSettings) {
        const player = this.getPlayer(src)
        if (!player) {
            console.error(locale('player_not_found', src))
            return
        }

        player.voiceSettings.microphone = state ? (settings ?? {}) : undefined

        emitNet('client:yaca:microphone', -1, src, state, settings)
    }

    /**
     * Get the alive status of a player.
     *
     * @param playerId - The ID of the player to get the alive status for.
     */
    getPlayerAliveStatus(playerId: number) {
        return this.players.get(playerId)?.voiceSettings.forceMuted ?? false
    }

    /**
     * Used if a player reconnects to the server.
     *
     * @param {number} src - The source-id of the player to reconnect.
     */
    playerReconnect(src: number) {
        const player = this.players.get(src)
        if (!player) {
            return
        }

        if (!player.voiceSettings.voiceFirstConnect) {
            return
        }

        this.connect(src)
    }

    /**
     * Change the voice range of a player.
     *
     * @param {number} src - The source-id of the player to change the voice range for.
     * @param {number} range - The new voice range. Defaults to the default voice range if not provided.
     */
    changeVoiceRange(src: number, range?: number) {
        const playerState = Player(src).state

        playerState.set(VOICE_RANGE_STATE_NAME, range ?? this.defaultVoiceRange, true)
        emitNet('client:yaca:changeVoiceRange', src, range)
    }

    /**
     * Get the voice range of a player.
     *
     * @param playerId - The ID of the player to get the voice range for.
     */
    getPlayerVoiceRange(playerId: number) {
        const playerState = Player(playerId).state
        return playerState[VOICE_RANGE_STATE_NAME] ?? this.defaultVoiceRange
    }

    /**
     * Sends initial data needed to connect to teamspeak plugin.
     *
     * @param {number} src - The source-id of the player to connect
     */
    connect(src: number) {
        const player = this.players.get(src)
        if (!player) {
            console.error(`YaCA: Missing player data for ${src}.`)
            return
        }

        player.voiceSettings.voiceFirstConnect = true

        const initObject: DataObject = {
            suid: this.serverConfig.uniqueServerId,
            chid: this.serverConfig.ingameChannelId,
            deChid: this.serverConfig.defaultChannelId,
            channelPassword: this.serverConfig.ingameChannelPassword,
            ingameName: player.voiceSettings.ingameName,
            useWhisper: this.serverConfig.useWhisper,
            excludeChannels: this.serverConfig.excludeChannels,
        }
        emitNet('client:yaca:init', src, initObject)
    }

    /**
     * Add new player to all other players on connect or reconnect, so they know about some variables.
     *
     * @param src - The source-id of the player to add.
     * @param {number} clientId - The client ID of the player.
     * @param {string} tsUniqueIdentifier - The TeamSpeak client unique identifier of the player, if reported.
     */
    addNewPlayer(src: number, clientId: number, tsUniqueIdentifier?: string) {
        const player = this.players.get(src)
        if (!player || !clientId) {
            return
        }

        if (tsUniqueIdentifier) {
            player.voiceSettings.tsUniqueIdentifier = tsUniqueIdentifier
            emit('yaca:external:playerTeamSpeakIdentifier', src, tsUniqueIdentifier)
        }

        player.voicePlugin = {
            playerId: src,
            clientId,
            forceMuted: player.voiceSettings.forceMuted,
            mutedOnPhone: player.voiceSettings.mutedOnPhone,
            volumeModifier: player.voiceSettings.volumeModifier,
        }

        emitNet('client:yaca:addPlayers', -1, player.voicePlugin)

        const allPlayersData = []
        const activeMicrophones: [number, NonNullable<YaCAPlayer['voiceSettings']['microphone']>][] = []
        for (const playerSource of getPlayers()) {
            const intPlayerSource = Number.parseInt(playerSource, 10)
            const playerServer = this.players.get(intPlayerSource)
            if (!playerServer) {
                continue
            }

            if (!playerServer.voicePlugin || intPlayerSource === src) {
                continue
            }

            allPlayersData.push(playerServer.voicePlugin)

            if (playerServer.voiceSettings.microphone) {
                activeMicrophones.push([intPlayerSource, playerServer.voiceSettings.microphone])
            }
        }

        emitNet('client:yaca:addPlayers', src, allPlayersData)

        for (const [microphoneSource, microphone] of activeMicrophones) {
            emitNet('client:yaca:microphone', src, microphoneSource, true, microphone)
        }
    }
}
