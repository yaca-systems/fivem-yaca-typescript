import { GLOBAL_ERROR_LEVEL_STATE_NAME, VOICE_RANGE_STATE_NAME, getGlobalErrorLevel, initLocale, loadConfig, setGlobalErrorLevel } from '@yaca-voice/common'
import {
    type DataObject,
    type ServerCache,
    type YacaServerConfig,
    type YacaSharedConfig,
    type YacaTowerConfig,
    defaultServerConfig,
    defaultSharedConfig,
    defaultTowerConfig,
} from '@yaca-voice/types'
import { YaCAServerSaltyChatBridge } from '../bridge/saltychat'
import { checkVersion, generateRandomName } from '../utils'
import { triggerClientEvent } from '../utils/events'
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
    }
    radioSettings: {
        activated: boolean
        hasLong: boolean
        frequencies: Record<number, string>
    }
    voicePlugin?: {
        playerId: number
        clientId: number
        forceMuted: boolean
        mutedOnPhone: boolean
    }
}

/**
 * The main server module for YaCA.
 */
export class YaCAServerModule {
    cache: ServerCache

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
        onNet('server:yaca:addPlayer', (clientId: number) => {
            this.addNewPlayer(source, clientId)
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

        for (const [targetId, emitterTargets] of player.voiceSettings.emittedPhoneSpeaker) {
            const target = this.players.get(targetId)
            if (!target || !target.voicePlugin) {
                continue
            }

            triggerClientEvent('client:yaca:phoneHearAround', Array.from(emitterTargets), [target.voicePlugin.clientId], false)
        }

        emitNet('client:yaca:disconnect', -1, src)
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
     */
    addNewPlayer(src: number, clientId: number) {
        const player = this.players.get(src)
        if (!player || !clientId) {
            return
        }

        player.voicePlugin = {
            playerId: src,
            clientId,
            forceMuted: player.voiceSettings.forceMuted,
            mutedOnPhone: player.voiceSettings.mutedOnPhone,
        }

        emitNet('client:yaca:addPlayers', -1, player.voicePlugin)

        const allPlayersData = []
        for (const playerSource of getPlayers()) {
            const intPlayerSource = Number.parseInt(playerSource)
            const playerServer = this.players.get(intPlayerSource)
            if (!playerServer) {
                continue
            }

            if (!playerServer.voicePlugin || intPlayerSource === src) {
                continue
            }

            allPlayersData.push(playerServer.voicePlugin)
        }

        emitNet('client:yaca:addPlayers', src, allPlayersData)
    }
}
