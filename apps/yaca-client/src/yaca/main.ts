import {
    GLOBAL_ERROR_LEVEL_STATE_NAME,
    LIP_SYNC_STATE_NAME,
    MEGAPHONE_STATE_NAME,
    VOICE_RANGE_STATE_NAME,
    clamp,
    initLocale,
    loadConfig,
    locale,
} from '@yaca-voice/common'
import {
    CommDeviceMode,
    type DataObject,
    type YacaClient,
    YacaFilterEnum,
    YacaNotificationType,
    type YacaPlayerData,
    type YacaPluginPlayerData,
    YacaPluginStates,
    type YacaProtocol,
    type YacaResponse,
    type YacaSharedConfig,
    type YacaSoundStateMessage,
    type YacaStereoMode,
    type YacaTowerConfig,
    defaultSharedConfig,
    defaultTowerConfig,
} from '@yaca-voice/types'
import { YaCAClientSaltyChatBridge } from '../bridge/saltychat'
import {
    WebSocket,
    cache,
    calculateDistanceVec3,
    convertNumberArrayToXYZ,
    displayRdrNotification,
    getCamDirection,
    joaat,
    playRdrFacialAnim,
    registerRdrKeyBind,
    vehicleHasOpening,
} from '../utils'
import { localLipSyncAnimations } from './data'
import { YaCAClientIntercomModule } from './intercom'
import { YaCAClientMegaphoneModule } from './megaphone'
import { YaCAClientPhoneModule } from './phone'
import { YaCAClientRadioModule } from './radio'

/**
 * The YaCA client module.
 * This module is responsible for handling the client side of the voice plugin.
 * It also handles the websocket connection to the voice plugin.
 */
export class YaCAClientModule {
    websocket: WebSocket

    sharedConfig: YacaSharedConfig
    towerConfig: YacaTowerConfig

    mufflingVehicleWhitelistHash = new Set<number>()
    allPlayers = new Map<number, YacaPlayerData>()
    firstConnect = true

    radioModule: YaCAClientRadioModule
    phoneModule: YaCAClientPhoneModule
    megaphoneModule: YaCAClientMegaphoneModule
    intercomModule: YaCAClientIntercomModule

    saltyChatBridge?: YaCAClientSaltyChatBridge

    canChangeVoiceRange = true
    defaultVoiceRange = 1
    rangeIndex: number
    rangeInterval: CitizenTimer | null = null
    visualVoiceRangeTimeout: CitizenTimer | null = null
    visualVoiceRangeTick: CitizenTimer | null = null
    voiceRangeViaMouseWheelTick: CitizenTimer | null = null

    isTalking = false
    useWhisper = false
    spectatingPlayer: number | false = false

    isMicrophoneMuted = false
    isMicrophoneDisabled = false
    isSoundMuted = false
    isSoundDisabled = false

    currentlyPhoneSpeakerApplied = new Set<number>()
    currentlySendingPhoneSpeakerSender = new Set<number>()
    phoneHearNearbyPlayer = new Set<number>()

    isFiveM = cache.game === 'fivem'
    isRedM = cache.game === 'redm'

    private currentPluginState: YacaPluginStates

    /**
     * Sets the current plugin state and emits an event.
     *
     * @param state - The new plugin state.
     */
    setCurrentPluginState(state: YacaPluginStates) {
        if (this.currentPluginState === state) {
            return
        }

        this.currentPluginState = state
        emit('yaca:external:pluginStateChanged', state)

        this.saltyChatBridge?.handleChangePluginState(state)
    }

    /**
     * Sends a radar notification.
     *
     * @param {string} message - The message to be sent in the notification.
     * @param {YacaNotificationType} type - The type of the notification, e.g. error, inform, success.
     */
    notification(message: string, type: YacaNotificationType) {
        if (this.sharedConfig.notifications.oxLib) {
            emit('ox_lib:notify', {
                id: 'yaca',
                title: 'YaCA',
                description: message,
                type,
            })
        }

        if (this.sharedConfig.notifications.okoknotify && GetResourceState('okokNotify') === 'started') {
            const okType = type === YacaNotificationType.INFO ? 'info' : type
            exports.okokNotify.Alert('YaCA', message, 2000, okType)
        }

        if (this.sharedConfig.notifications.gta) {
            if (this.isFiveM) {
                BeginTextCommandThefeedPost('STRING')
                AddTextComponentSubstringPlayerName(`YaCA: ${message}`)
                if (type === YacaNotificationType.ERROR) {
                    ThefeedSetNextPostBackgroundColor(6)
                }
                EndTextCommandThefeedPostTicker(false, false)
            } else {
                console.warn('[YaCA] GTA notification is only available in FiveM.')
            }
        }

        if (this.sharedConfig.notifications.redm) {
            if (this.isRedM) {
                displayRdrNotification(`YaCA: ${message}`, 2000)
            } else {
                console.warn('[YaCA] RedM notification is only available in RedM.')
            }
        }

        if (this.sharedConfig.notifications.own) {
            emit('yaca:external:notification', message, type)
        }
    }

    constructor() {
        this.sharedConfig = loadConfig<YacaSharedConfig>('config/shared.json5', defaultSharedConfig)
        this.towerConfig = loadConfig<YacaTowerConfig>('config/tower.json5', defaultTowerConfig)
        initLocale(this.sharedConfig.locale)

        this.rangeIndex = this.sharedConfig.voiceRange.defaultIndex
        if (this.sharedConfig.voiceRange.ranges[this.rangeIndex]) {
            this.defaultVoiceRange = this.sharedConfig.voiceRange.ranges[this.rangeIndex]
        } else {
            this.defaultVoiceRange = 1
            this.rangeIndex = 0
            this.sharedConfig.voiceRange.ranges = [1]

            console.error('[YaCA] Default voice range is not set correctly in the config.')
        }

        if (this.isFiveM) {
            for (const vehicleModel of this.sharedConfig.mufflingSettings.vehicleMuffling.vehicleWhitelist) {
                this.mufflingVehicleWhitelistHash.add(joaat(vehicleModel))
            }
        }

        this.websocket = new WebSocket()
        this.setCurrentPluginState(YacaPluginStates.NOT_CONNECTED)

        /**
         * Register the NUI callback types.
         */
        RegisterNuiCallbackType('YACA_OnNuiReady')
        on('__cfx_nui:YACA_OnNuiReady', (_: unknown, cb: (data: unknown) => void) => {
            this.websocket.nuiReady = true

            if (this.sharedConfig.autoConnectOnJoin) {
                setTimeout(() => {
                    emitNet('server:yaca:nuiReady')
                }, 5000)
            }

            // skipcq: JS-0255
            cb({})
        })

        this.registerExports()
        this.registerEvents()
        if (this.isFiveM) {
            this.registerKeybindings()
        } else if (this.isRedM) {
            this.registerRdrKeybindings()
        }

        this.intercomModule = new YaCAClientIntercomModule(this)
        this.megaphoneModule = new YaCAClientMegaphoneModule(this)
        this.phoneModule = new YaCAClientPhoneModule(this)
        this.radioModule = new YaCAClientRadioModule(this)

        if (!this.sharedConfig.useLocalLipSync) {
            /**
             * Add a state bag change handler for the lip sync state bag.
             * Which is used to override the talking state of the player.
             */
            AddStateBagChangeHandler(LIP_SYNC_STATE_NAME, '', (bagName: string, _: string, value: boolean, __: number) => {
                const playerId = GetPlayerFromStateBagName(bagName)
                if (playerId === 0) {
                    return
                }

                SetPlayerTalkingOverride(playerId, value)
            })

            /**
             * Add a state bag change handler for the global error level state bag.
             * Which is used to override the global error level.
             */
            AddStateBagChangeHandler(GLOBAL_ERROR_LEVEL_STATE_NAME, '', (_bagName: string, _key: string, _value: number, __: number) => {
                setImmediate(() => {
                    this.phoneModule.enablePhoneCall(Array.from(this.phoneModule.inCallWith), true)
                })
            })
        }

        if (this.sharedConfig.saltyChatBridge) {
            this.radioModule.secondaryRadioChannel = 2
            this.saltyChatBridge = new YaCAClientSaltyChatBridge(this)
        }

        console.log('[Client] YaCA Client loaded.')
    }

    registerExports() {
        /**
         * Get the current voice range.
         *
         * @returns {number} The current voice range.
         */
        exports('getVoiceRange', () => this.getVoiceRange())

        /**
         * Get all voice ranges.
         *
         * @returns {number[]} All available voice ranges.
         */
        exports('getVoiceRanges', () => this.sharedConfig.voiceRange.ranges)

        /**
         * Change the voice range to the next range.
         *
         * @param {boolean} increase - If the voice range should be increased or decreased.
         */
        exports('changeVoiceRange', (increase = true) => {
            this.changeVoiceRange(increase)
        })

        /**
         * Set the voice range to the given value.
         *
         * @param {number} range - The voice range to set
         */
        exports('setVoiceRange', (range: number) => {
            this.setVoiceRange(range)
        })

        /**
         * Get microphone mute state.
         *
         * @returns {boolean} The microphone mute state.
         */
        exports('getMicrophoneMuteState', () => this.isMicrophoneMuted)

        /**
         * Get microphone disabled state.
         *
         * @returns {boolean} The microphone disabled state.
         */
        exports('getMicrophoneDisabledState', () => this.isMicrophoneDisabled)

        /**
         * Get sound mute state.
         *
         * @returns {boolean}
         */
        exports('getSoundMuteState', () => this.isSoundMuted)

        /**
         * Get sound disabled state.
         *
         * @returns {boolean}
         */
        exports('getSoundDisabledState', () => this.isSoundDisabled)

        /**
         * Get the plugin state.
         *
         * @returns {YacaPluginStates} The current plugin state.
         */
        exports('getPluginState', () => this.currentPluginState ?? YacaPluginStates.NOT_CONNECTED)

        /**
         * Get the global error level.
         *
         * @returns {number} The global error level.
         */
        exports('getGlobalErrorLevel', () => GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? 0)

        /**
         * Set the player that should be spectated.
         *
         * @param {number | false} player - The player to be spectated.
         */
        exports('setSpectatingPlayer', (player: number | false) => {
            this.spectatingPlayer = player
        })

        /**
         * Get the player that is currently spectated.
         *
         * @returns {number | false} The player that is currently spectated. False if no player is spectated.
         */
        exports('getSpectatingPlayer', () => this.spectatingPlayer)
    }

    /**
     * Registers the keybindings for the plugin.
     * This is only available in FiveM.
     */
    registerKeybindings() {
        if (this.sharedConfig.keyBinds.increaseVoiceRange !== false) {
            /**
             * Registers the "yaca:increaseVoiceRange" command and keybinding.
             * This command is used to change the voice range.
             */
            RegisterCommand(
                'yaca:increaseVoiceRange',
                () => {
                    this.changeVoiceRange(true)
                },
                false,
            )
            RegisterKeyMapping('yaca:increaseVoiceRange', locale('change_voice_range_increase'), 'keyboard', this.sharedConfig.keyBinds.increaseVoiceRange)
        }

        if (this.sharedConfig.keyBinds.decreaseVoiceRange !== false) {
            /**
             * Registers the "yaca:decreaseVoiceRange" command and keybinding.
             * This command is used to change the voice range.
             */
            RegisterCommand(
                'yaca:decreaseVoiceRange',
                () => {
                    this.changeVoiceRange(false)
                },
                false,
            )
            RegisterKeyMapping('yaca:decreaseVoiceRange', locale('change_voice_range_decrease'), 'keyboard', this.sharedConfig.keyBinds.decreaseVoiceRange)
        }

        if (this.sharedConfig.keyBinds.voiceRangeWithMouseWheel !== false) {
            /**
             * Registers the "+yaca:changeVoiceRangeWithMousewheel" command and keybinding.
             * This command is used to change the voice range.
             */
            RegisterCommand(
                '+yaca:changeVoiceRangeWithMousewheel',
                () => {
                    this.voiceRangeViaMouseWheelTick = setInterval(() => {
                        this.handleVoiceRangeViaMouseWheel()
                    })
                },
                false,
            )

            RegisterCommand(
                '-yaca:changeVoiceRangeWithMousewheel',
                () => {
                    if (this.voiceRangeViaMouseWheelTick) {
                        clearInterval(this.voiceRangeViaMouseWheelTick)
                        this.voiceRangeViaMouseWheelTick = null
                    }
                },
                false,
            )

            RegisterKeyMapping(
                '+yaca:changeVoiceRangeWithMousewheel',
                locale('change_voice_range_via_mousewheel'),
                'keyboard',
                this.sharedConfig.keyBinds.voiceRangeWithMouseWheel,
            )
        }
    }

    /**
     * Registers the keybindings for RedM.
     * This is only available in RedM.
     */
    registerRdrKeybindings() {
        if (this.sharedConfig.keyBinds.increaseVoiceRange !== false) {
            /**
             * Registers the keybinding for changing the voice Range.
             */
            registerRdrKeyBind(this.sharedConfig.keyBinds.increaseVoiceRange, () => {
                this.changeVoiceRange()
            })
        }

        if (this.sharedConfig.keyBinds.decreaseVoiceRange !== false) {
            /**
             * Registers the keybinding for changing the voice Range.
             */
            registerRdrKeyBind(this.sharedConfig.keyBinds.decreaseVoiceRange, () => {
                this.changeVoiceRange(false)
            })
        }

        if (this.sharedConfig.keyBinds.voiceRangeWithMouseWheel !== false) {
            /**
             * Registers the "+yaca:changeVoiceRangeWithScroll" command and keybinding.
             * This command is used to change the voice range.
             */

            registerRdrKeyBind(
                this.sharedConfig.keyBinds.voiceRangeWithMouseWheel,
                () => {
                    this.voiceRangeViaMouseWheelTick = setInterval(() => {
                        this.handleVoiceRangeViaMouseWheel()
                    })
                },
                () => {
                    if (this.voiceRangeViaMouseWheelTick) {
                        clearInterval(this.voiceRangeViaMouseWheelTick)
                        this.voiceRangeViaMouseWheelTick = null
                    }
                },
            )
        }
    }

    /**
     * Registers the events for the plugin.
     */
    registerEvents() {
        /**
         * Handles the "onPlayerJoining" server event.
         *
         * @param {number} target - The ID of the target.
         */
        onNet('onPlayerJoining', (target: number) => {
            const player = this.getPlayerByID(target)
            if (!player) {
                return
            }

            const frequency = this.radioModule?.playersWithShortRange.get(target)
            if (frequency) {
                const channel = this.radioModule?.findRadioChannelByFrequency(frequency)
                if (channel) {
                    this.setPlayersCommType(
                        player,
                        YacaFilterEnum.RADIO,
                        true,
                        channel,
                        undefined,
                        CommDeviceMode.RECEIVER,
                        CommDeviceMode.SENDER,
                        GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? undefined,
                    )
                    this.saltyChatBridge?.handleRadioReceivingStateChange(true, channel)
                }
            }
        })

        /**
         * Handles the "onPlayerDropped" server event.
         *
         * @param {number} target - The ID of the target.
         */
        onNet('onPlayerDropped', (target: number) => {
            const player = this.getPlayerByID(target)
            if (!player) {
                return
            }

            this.phoneModule.removePhoneSpeakerFromEntity(target)

            const frequency = this.radioModule?.playersWithShortRange.get(target)
            if (frequency) {
                const channel = this.radioModule?.findRadioChannelByFrequency(frequency)
                if (channel) {
                    this.setPlayersCommType(
                        player,
                        YacaFilterEnum.RADIO,
                        false,
                        channel,
                        undefined,
                        CommDeviceMode.RECEIVER,
                        CommDeviceMode.SENDER,
                        GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? undefined,
                    )

                    if (this.saltyChatBridge) {
                        const inRadio = this.radioModule?.playersInRadioChannel.get(channel)
                        if (inRadio) {
                            const inRadioArray = [...inRadio].filter((id) => id !== target)
                            const state = inRadioArray.length > 0
                            this.saltyChatBridge.handleRadioReceivingStateChange(state, channel)
                        }
                    }
                }
            }
        })

        /**
         * Handles the "onResourceStop" event.
         *
         * @param {string} resourceName - The name of the resource that has started.
         */
        on('onResourceStop', (resourceName: string) => {
            if (cache.resource !== resourceName) {
                return
            }

            if (this.websocket.initialized) {
                this.websocket.close()
            }
        })

        /**
         * Handles the "client:yaca:init" server event.
         *
         * @param {DataObject} dataObj - The data object to be initialized.
         */
        onNet('client:yaca:init', async (dataObj: DataObject) => {
            if (this.rangeInterval) {
                clearInterval(this.rangeInterval)
                this.rangeInterval = null
            }

            if (!this.websocket.initialized) {
                this.websocket.initialized = true

                this.websocket.on('message', (msg: string) => {
                    this.handleResponse(msg)
                })

                this.websocket.on('close', (code: number, reason: string) => {
                    this.setCurrentPluginState(YacaPluginStates.NOT_CONNECTED)

                    console.error('[YACA-Websocket]: client disconnected', code, reason)
                })

                this.websocket.on('open', () => {
                    this.setCurrentPluginState(YacaPluginStates.CONNECTED)

                    if (this.firstConnect) {
                        this.initRequest(dataObj)
                        this.firstConnect = false
                    } else {
                        emitNet('server:yaca:wsReady')
                    }

                    console.log('[YACA-Websocket]: Successfully connected to the voice plugin')
                })

                await this.websocket.start()
            }

            if (this.firstConnect) {
                return
            }

            this.initRequest(dataObj)
        })

        /**
         * Handles the "client:yaca:disconnect" server event.
         *
         * @param {number} remoteId - The remote ID of the player to be disconnected.
         *
         */
        onNet('client:yaca:disconnect', (remoteId: number) => {
            this.phoneModule.handleDisconnect(remoteId)
            this.allPlayers.delete(remoteId)
        })

        /**
         * Handles the "client:yaca:addPlayers" server event.
         *
         * @param {DataObject | DataObject[]} dataObjects - The data object or objects to be added.
         */
        onNet('client:yaca:addPlayers', (dataObjects: DataObject | DataObject[]) => {
            if (!Array.isArray(dataObjects)) {
                dataObjects = [dataObjects]
            }

            const newPlayers: number[] = []
            for (const dataObj of dataObjects) {
                if (!dataObj || typeof dataObj.clientId === 'undefined' || typeof dataObj.playerId === 'undefined') {
                    continue
                }

                const currentData = this.getPlayerByID(dataObj.playerId)

                this.allPlayers.set(dataObj.playerId, {
                    remoteID: dataObj.playerId,
                    clientId: dataObj.clientId,
                    forceMuted: dataObj.forceMuted || false,
                    phoneCallMemberIds: currentData?.phoneCallMemberIds || undefined,
                    mutedOnPhone: dataObj.mutedOnPhone || false,
                })

                newPlayers.push(dataObj.playerId)
            }

            this.phoneModule.reestablishCalls(newPlayers)
        })

        /**
         * Handles the "client:yaca:muteTarget" server event.
         *
         * @param {number} target - The target to be muted.
         * @param {boolean} muted - The mute status.
         */
        onNet('client:yaca:muteTarget', (target: number, muted: boolean) => {
            const player = this.getPlayerByID(target)
            if (!player) return

            player.forceMuted = muted
        })

        /**
         * Handles the "client:yaca:changeOwnVoiceRange" server event.
         *
         * @param {number} range - The new voice range.
         */
        onNet('client:yaca:changeVoiceRange', (range: number) => {
            emit('yaca:external:voiceRangeUpdate', range, this.rangeIndex)
            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_VoiceRangeChanged', range.toFixed(1), this.rangeIndex, this.sharedConfig.voiceRange.ranges.length)
            }
        })

        /**
         * Handles the "client:yaca:notification" server event.
         *
         * @param {string} message - The message to be sent in the notification.
         * @param {YacaNotificationType} type - The type of the notification, e.g. error, inform, success.
         */
        onNet('client:yaca:notification', (message: string, type: YacaNotificationType) => {
            this.notification(message, type)
        })

        /**
         * Handles the "txcl:spectate:start" server event.
         *
         * @param {number} targetServerId - The ID of the target server that is spectated.
         */
        onNet('txcl:spectate:start', (targetServerId: number) => {
            this.spectatingPlayer = targetServerId
        })

        /**
         * Handles the "txcl:spectate:stop" server event.
         */
        onNet('client:yaca:txadmin:stopspectate', () => {
            this.spectatingPlayer = false
        })
    }

    /**
     * Get the player by remote ID.
     *
     * @param remoteId The remote ID of the player.
     */
    getPlayerByID(remoteId: number) {
        return this.allPlayers.get(remoteId)
    }

    /**
     * Get the player by client ID.
     *
     * @param clientId The client ID (TeamSpeak) of the player.
     * @returns The player data.
     */
    getPlayerByClientId(clientId: number) {
        for (const player of this.allPlayers.values()) {
            if (player.clientId === clientId) {
                return player
            }
        }

        return null
    }

    /**
     * Initializes the plugin.
     *
     * @param {DataObject} dataObj - The data object to initialize the plugin with.
     */
    initRequest(dataObj: DataObject) {
        if (
            !dataObj ||
            !dataObj.suid ||
            typeof dataObj.chid !== 'number' ||
            !dataObj.deChid ||
            !dataObj.ingameName ||
            typeof dataObj.channelPassword === 'undefined'
        ) {
            console.log('[YACA-Websocket]: Error while initializing plugin')
            this.notification(locale('connect_error'), YacaNotificationType.ERROR)
            return
        }

        this.sendWebsocket({
            base: { request_type: 'INIT' },
            server_guid: dataObj.suid,
            ingame_name: dataObj.ingameName,
            ingame_channel: dataObj.chid,
            default_channel: dataObj.deChid,
            ingame_channel_password: dataObj.channelPassword,
            excluded_channels: dataObj.excludeChannels,
            muffling_range: this.sharedConfig.mufflingSettings.mufflingRange,
            build_type: this.sharedConfig.buildType,
            unmute_delay: this.sharedConfig.unmuteDelay,
            operation_mode: dataObj.useWhisper ? 1 : 0,
        })

        this.useWhisper = dataObj.useWhisper ?? false
    }

    /**
     * Checks if the plugin is initialized.
     *
     * @returns {boolean} Returns true if the plugin is initialized, false otherwise.
     */
    isPluginInitialized(silent = false): boolean {
        const initialized = Boolean(this.getPlayerByID(cache.serverId))

        if (!initialized && !silent) {
            this.notification(locale('plugin_not_initialized'), YacaNotificationType.ERROR)
        }

        return initialized
    }

    /**
     * Sends a message to the voice plugin via websocket.
     *
     * @param {object} msg - The message to be sent.
     */
    sendWebsocket(msg: object) {
        if (!this.websocket) {
            console.error('[Voice-Websocket]: No websocket created')
            return
        }

        this.websocket.send(msg)
    }

    /**
     * Handles messages from the voice plugin.
     *
     * @param {string} payload - The response from the voice plugin.
     */
    handleResponse(payload: string) {
        if (!payload) {
            return
        }

        let parsedPayload: YacaResponse

        try {
            parsedPayload = JSON.parse(payload)
        } catch (e) {
            console.error('[YaCA-Websocket]: Error while parsing message: ', e)
            return
        }

        switch (parsedPayload.code) {
            case 'OK':
                if (parsedPayload.requestType === 'JOIN') {
                    const clientId = Number.parseInt(parsedPayload.message)
                    emitNet('server:yaca:addPlayer', clientId)

                    if (this.rangeInterval) {
                        clearInterval(this.rangeInterval)
                        this.rangeInterval = null
                    }

                    this.rangeInterval = setInterval(this.calcPlayers.bind(this), 250)

                    // Set radio settings on reconnect only, else on first opening
                    if (this.radioModule.radioInitialized) {
                        this.radioModule.initRadioSettings()
                    }

                    emit('yaca:external:pluginInitialized', clientId)
                    return
                }

                return
            case 'TALK_STATE':
                this.handleTalkState(parsedPayload)
                return
            case 'SOUND_STATE':
                this.handleSoundState(parsedPayload)
                return
            case 'OTHER_TALK_STATE':
                this.handleOtherTalkState(parsedPayload)
                return
            case 'MOVED_CHANNEL':
                this.handleMovedChannel(parsedPayload.message)
                return
            case 'WRONG_TS_SERVER':
                this.setCurrentPluginState(YacaPluginStates.WRONG_TS_SERVER)
                this.notification(locale('wrong_ts_server') ?? 'You are connected to the wrong teamspeak server!', YacaNotificationType.ERROR)
                return
            case 'OUTDATED_VERSION':
                this.setCurrentPluginState(YacaPluginStates.OUTDATED_VERSION)
                this.notification(
                    locale('outdated_plugin', parsedPayload.message) ?? `Your plugin is outdated, please update to version ${parsedPayload.message}!`,
                    YacaNotificationType.ERROR,
                )
                return
            case 'MAX_PLAYER_COUNT_REACHED':
                this.notification(
                    locale('max_players_reached') ?? 'Your license reached the maximum player count. Please upgrade your license.',
                    YacaNotificationType.ERROR,
                )
                return
            case 'LICENSE_SERVER_TIMED_OUT':
                this.notification(
                    locale('license_server_timed_out') ?? 'The connection to the license server timed out, while verifying the license. Please wait a moment.',
                    YacaNotificationType.ERROR,
                )
                return
            case 'MOVE_ERROR':
                this.notification(locale('move_error') ?? 'You are not connected to the teamspeak server!', YacaNotificationType.ERROR)
                return
            case 'WAIT_GAME_INIT':
            case 'HEARTBEAT':
            case 'MUTE_STATE':
                return
            default:
                console.log(`[YaCA-Websocket]: Unknown error code: ${parsedPayload.code}`)
                this.notification(locale('unknown_error', parsedPayload.code) ?? `Unknown error code: ${parsedPayload.code}`, YacaNotificationType.ERROR)
                return
        }
    }

    /**
     * Sets a variable for a player.
     *
     * @param {string} player - The player for whom the variable is to be set.
     * @param {string} variable - The name of the variable.
     * @param {*} value - The value to be set for the variable.
     */
    setPlayerVariable(player: number, variable: string, value: unknown) {
        const currentData = this.getPlayerByID(player)
        if (!currentData) return

        // @ts-expect-error Object cannot be undefined
        currentData[variable] = value
    }

    /**
     * Get the current voice range.
     *
     * @returns {number} The current voice range.
     */
    getVoiceRange(): number {
        return LocalPlayer.state[VOICE_RANGE_STATE_NAME] ?? this.defaultVoiceRange
    }

    /**
     * Changes the voice range to the next range.
     *
     * @param {boolean} increase - If the voice range should be increased or decreased.
     */
    changeVoiceRange(increase = true) {
        if (!this.canChangeVoiceRange) return

        const currentVoiceRange = this.getVoiceRange()
        if (increase) {
            const newIndex = this.sharedConfig.voiceRange.ranges.findIndex((range) => range > currentVoiceRange)
            this.rangeIndex = newIndex !== -1 ? newIndex : 0
        } else {
            const newIndex = this.sharedConfig.voiceRange.ranges
                .slice()
                .reverse()
                .findIndex((range) => range < currentVoiceRange)
            this.rangeIndex = newIndex !== -1 ? this.sharedConfig.voiceRange.ranges.length - 1 - newIndex : this.sharedConfig.voiceRange.ranges.length - 1
        }

        const voiceRange = this.sharedConfig.voiceRange.ranges[this.rangeIndex] ?? 1
        this.changeVoiceRangeInternal(voiceRange)
    }

    /**
     * Set the voice range to the given value.
     *
     * @param voiceRange - The voice range to set
     */
    setVoiceRange(voiceRange: number) {
        this.rangeIndex = -1
        this.changeVoiceRangeInternal(voiceRange)
    }

    /**
     * Internal function to change the voice range.
     *
     * @param voiceRange - The voice range to set
     * @private
     */
    private changeVoiceRangeInternal(voiceRange: number) {
        if (!this.canChangeVoiceRange) return

        this.showRangeVisual(voiceRange)

        LocalPlayer.state.set(VOICE_RANGE_STATE_NAME, voiceRange, true)

        emit('yaca:external:voiceRangeUpdate', voiceRange, this.rangeIndex)
        // SaltyChat bridge
        if (this.saltyChatBridge) {
            emit('SaltyChat_VoiceRangeChanged', voiceRange.toFixed(1), this.rangeIndex, this.sharedConfig.voiceRange.ranges.length)
        }
    }

    /**
     * Shows the voice range visuals.
     *
     * @param newVoiceRange - The new voice range
     */
    showRangeVisual(newVoiceRange: number) {
        if (this.visualVoiceRangeTimeout) {
            clearTimeout(this.visualVoiceRangeTimeout)
            this.visualVoiceRangeTimeout = null
        }

        if (this.visualVoiceRangeTick) {
            clearInterval(this.visualVoiceRangeTick)
            this.visualVoiceRangeTick = null
        }

        if (this.sharedConfig.voiceRange.sendNotification) {
            this.notification(locale('voice_range_changed', newVoiceRange), YacaNotificationType.INFO)
        }

        if (this.sharedConfig.voiceRange.markerColor.enabled) {
            const red = this.sharedConfig.voiceRange.markerColor.r
            const green = this.sharedConfig.voiceRange.markerColor.g
            const blue = this.sharedConfig.voiceRange.markerColor.b
            const alpha = this.sharedConfig.voiceRange.markerColor.a
            const duration = this.sharedConfig.voiceRange.markerColor.duration

            this.visualVoiceRangeTimeout = setTimeout(() => {
                if (this.visualVoiceRangeTick) {
                    clearInterval(this.visualVoiceRangeTick)
                    this.visualVoiceRangeTick = null
                }

                this.visualVoiceRangeTimeout = null
            }, duration)

            this.visualVoiceRangeTick = setInterval(() => {
                const entity = cache.vehicle || cache.ped
                const pos = GetEntityCoords(entity, false)
                const posZ = cache.vehicle ? pos[2] - 0.6 : pos[2] - 0.98

                DrawMarker(
                    this.isFiveM ? 1 : 0x94fdae17,
                    pos[0],
                    pos[1],
                    posZ,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    newVoiceRange * 2,
                    newVoiceRange * 2,
                    1,
                    red,
                    green,
                    blue,
                    alpha,
                    false,
                    true,
                    2,
                    true,
                    // @ts-expect-error Type error in the native
                    null,
                    null,
                    false,
                )
            })
        }
    }

    /**
     * Checks if the communication type is valid.
     *
     * @param {string} type - The type of communication to be validated.
     * @returns {boolean} Returns true if the type is valid, false otherwise.
     */
    static isCommTypeValid(type: string): boolean {
        const valid = type in YacaFilterEnum
        if (!valid) {
            console.error(`[YaCA-Websocket]: Invalid comm type: ${type}`)
        }

        return valid
    }

    /**
     * Set the communication type for the given players.
     *
     * @param {YacaPlayerData | YacaPlayerData[]} players - The player or players for whom the communication type is to be set.
     * @param {YacaFilterEnum} type - The type of communication.
     * @param {boolean} state - The state of the communication.
     * @param {number} channel - The channel for the communication. Optional.
     * @param {number} range - The range for the communication. Optional.
     * @param {CommDeviceMode} ownMode - The mode for the player. Optional.
     * @param {CommDeviceMode} otherPlayersMode - The mode for the other players. Optional.
     * @param {number} errorLevel - The error level for the communication. Optional.
     */
    setPlayersCommType(
        players: { clientId: number } | { clientId: number }[],
        type: YacaFilterEnum,
        state: boolean,
        channel?: number | null,
        range?: number | null,
        ownMode?: CommDeviceMode,
        otherPlayersMode?: CommDeviceMode,
        errorLevel?: number | null,
    ) {
        if (!Array.isArray(players)) {
            players = [players]
        }

        const clientIds: YacaClient[] = []
        if (typeof ownMode !== 'undefined') {
            clientIds.push({
                client_id: this.getPlayerByID(cache.serverId)?.clientId,
                mode: ownMode,
            })
        }

        for (const player of players) {
            if (!player) {
                continue
            }

            const clientProtocol: YacaClient = {
                client_id: player.clientId,
                mode: otherPlayersMode,
            }

            if (typeof errorLevel !== 'undefined' && errorLevel !== null) {
                clientProtocol.errorLevel = errorLevel
            }

            clientIds.push(clientProtocol)
        }

        const protocol: YacaProtocol = {
            on: state,
            comm_type: type,
            members: clientIds,
        }

        if (typeof channel !== 'undefined' && channel !== null) {
            protocol.channel = channel
        }
        if (typeof range !== 'undefined' && range !== null) {
            protocol.range = range
        }

        this.sendWebsocket({
            base: { request_type: 'INGAME' },
            comm_device: protocol,
        })
    }

    /**
     * Update the volume for a specific communication type.
     *
     * @param {string} type - The type of communication.
     * @param {number} volume - The volume to be set.
     * @param {number} channel - The channel for the communication.
     */
    setCommDeviceVolume(type: YacaFilterEnum, volume: number, channel?: number) {
        if (!YaCAClientModule.isCommTypeValid(type)) {
            return
        }

        const protocol: YacaProtocol = {
            comm_type: type,
            volume: clamp(volume, 0, 1),
        }

        if (typeof channel !== 'undefined') {
            protocol.channel = channel
        }

        this.sendWebsocket({
            base: { request_type: 'INGAME' },
            comm_device_settings: protocol,
        })
    }

    /**
     * Update the stereo mode for a specific communication type.
     *
     * @param {YacaFilterEnum} type - The type of communication.
     * @param {YacaStereoMode} mode - The stereo mode to be set.
     * @param {number} channel - The channel for the communication.
     */
    setCommDeviceStereoMode(type: YacaFilterEnum, mode: YacaStereoMode, channel?: number) {
        if (!YaCAClientModule.isCommTypeValid(type)) {
            return
        }

        const protocol: YacaProtocol = {
            comm_type: type,
            output_mode: mode,
        }

        if (typeof channel !== 'undefined') {
            protocol.channel = channel
        }

        this.sendWebsocket({
            base: { request_type: 'INGAME' },
            comm_device_settings: protocol,
        })
    }

    /**
     * Set the player speaking state and start the lip animation.
     *
     * @param ped - The ped to sync the lips with.
     * @param playerId - The player ID to sync the lips with.
     * @param isTalking - The talking state of the player.
     */
    syncLipsPlayer(ped: number, playerId: number, isTalking: boolean) {
        const animationData = localLipSyncAnimations[cache.game][isTalking ? 'true' : 'false']

        SetPlayerTalkingOverride(playerId, isTalking)
        if (this.isFiveM) {
            PlayFacialAnim(ped, animationData.name, animationData.dict)
        } else if (this.isRedM) {
            playRdrFacialAnim(ped, animationData.name, animationData.dict)
        }
    }

    /**
     * Handles the talk and mute state from teamspeak, displays it in UI and syncs lip to other players.
     *
     * @param {YacaResponse} payload - The response from teamspeak.
     */
    handleTalkState(payload: YacaResponse) {
        const messageState = payload.message === '1'
        const isPlayerMuted = this.isMicrophoneMuted || this.isMicrophoneDisabled || this.isSoundMuted || this.isSoundDisabled

        const isTalking = !isPlayerMuted && messageState
        if (this.isTalking !== isTalking) {
            this.isTalking = isTalking

            this.syncLipsPlayer(cache.ped, cache.serverId, isTalking)
            LocalPlayer.state.set(LIP_SYNC_STATE_NAME, isTalking, true)

            emit('yaca:external:isTalking', isTalking)

            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_TalkStateChanged', isTalking)
            }
        }
    }

    /**
     * Handles the sound state from teamspeak.
     *
     * @param payload - The response from teamspeak.
     */
    handleSoundState(payload: YacaResponse) {
        const soundStates: YacaSoundStateMessage = JSON.parse(payload.message)

        if (this.isMicrophoneMuted !== soundStates.microphoneMuted) {
            this.isMicrophoneMuted = soundStates.microphoneMuted
            emit('yaca:external:microphoneMuteStateChanged', soundStates.microphoneMuted)
            emit('yaca:external:muteStateChanged', soundStates.microphoneMuted) // Deprecated in favor of microphoneMuteStateChanged

            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_MicStateChanged', soundStates.microphoneMuted)
            }
        }

        if (this.isMicrophoneDisabled !== soundStates.microphoneDisabled) {
            this.isMicrophoneDisabled = soundStates.microphoneDisabled
            emit('yaca:external:microphoneDisabledStateChanged', soundStates.microphoneDisabled)

            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_MicEnabledChanged', soundStates.microphoneDisabled)
            }
        }

        if (this.isSoundMuted !== soundStates.soundMuted) {
            this.isSoundMuted = soundStates.soundMuted
            emit('yaca:external:soundMuteStateChanged', soundStates.soundMuted)

            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_SoundStateChanged', soundStates.soundMuted)
            }
        }

        if (this.isSoundDisabled !== soundStates.soundDisabled) {
            this.isSoundDisabled = soundStates.soundDisabled
            emit('yaca:external:soundDisabledStateChanged', soundStates.soundDisabled)

            // SaltyChat bridge
            if (this.saltyChatBridge) {
                emit('SaltyChat_SoundEnabledChanged', soundStates.soundDisabled)
            }
        }
    }

    /**
     * Handles the talk state of other players.
     *
     * @param payload - The response from teamspeak.
     */
    handleOtherTalkState(payload: YacaResponse) {
        if (!this.sharedConfig.useLocalLipSync) {
            return
        }

        let talkData: { clientId: number; isTalking: boolean }

        try {
            talkData = JSON.parse(payload.message)
        } catch {
            console.error('[YaCA-Websocket]: Error while parsing other talk state message')
            return
        }

        const player = this.getPlayerByClientId(talkData.clientId)

        if (!player || !player.remoteID) {
            return
        }

        const playerId = GetPlayerFromServerId(player.remoteID)

        if (playerId === -1) {
            return
        }

        SetPlayerTalkingOverride(playerId, talkData.isTalking)
    }

    /**
     * Handles the moved channel event.
     *
     * @param newChannel - The new channel the player is in.
     */
    handleMovedChannel(newChannel: string) {
        if (newChannel !== 'INGAME_CHANNEL' && newChannel !== 'EXCLUDED_CHANNEL') {
            console.error('[YaCA-Websocket]: Unknown channel type: ', newChannel)
            return
        }

        if (newChannel === 'INGAME_CHANNEL') {
            this.setCurrentPluginState(YacaPluginStates.IN_INGAME_CHANNEL)
        } else {
            this.setCurrentPluginState(YacaPluginStates.IN_EXCLUDED_CHANNEL)
        }

        emit('yaca:external:channelChanged', newChannel)
    }

    /**
     * Checks if the vehicle has an opening.
     *
     * @param vehicle - The vehicle to check.
     */
    checkIfVehicleHasOpening(vehicle: number | false) {
        if (!vehicle) {
            return true
        }

        if (this.mufflingVehicleWhitelistHash.has(GetEntityModel(vehicle))) {
            return true
        }

        return vehicleHasOpening(vehicle)
    }

    /**
     * Get the muffle intensity for the nearby player.
     *
     * @param {number} playerPed - The player ped.
     * @param {number} nearbyPlayerPed - The nearby player ped.
     * @param {number} playerVehicle - The vehicle the player is in.
     * @param {number} ownCurrentRoom - The current room the client is in.
     * @param {boolean} ownVehicleHasOpening - The opening state ot the vehicle the client is in.
     * @param {boolean} nearbyUsesMegaphone - The state if the nearby player uses a megaphone.
     */
    getMuffleIntensity(
        playerPed: number,
        nearbyPlayerPed: number,
        playerVehicle: number | false,
        ownCurrentRoom: number,
        ownVehicleHasOpening: boolean,
        nearbyUsesMegaphone = false,
    ) {
        if (ownCurrentRoom !== GetRoomKeyFromEntity(nearbyPlayerPed) && !HasEntityClearLosToEntity(playerPed, nearbyPlayerPed, 17)) {
            return this.sharedConfig.mufflingSettings.intensities.differentRoom
        }

        const vehicleMuffling = this.sharedConfig.mufflingSettings.vehicleMuffling.enabled
        if (this.isRedM || !vehicleMuffling) {
            return 0
        }

        const nearbyPlayerVehicle = GetVehiclePedIsIn(nearbyPlayerPed, false)
        const ownVehicleId = playerVehicle || 0

        if (ownVehicleId === nearbyPlayerVehicle) {
            return 0
        }

        if (nearbyUsesMegaphone) {
            if (ownVehicleHasOpening) {
                return 0
            }

            return this.sharedConfig.mufflingSettings.intensities.megaPhoneInCar
        }

        const nearbyPlayerVehicleHasOpening = this.checkIfVehicleHasOpening(nearbyPlayerVehicle)

        if (!ownVehicleHasOpening && !nearbyPlayerVehicleHasOpening) {
            return this.sharedConfig.mufflingSettings.intensities.bothCarsClosed
        }

        if (!ownVehicleHasOpening || !nearbyPlayerVehicleHasOpening) {
            return this.sharedConfig.mufflingSettings.intensities.oneCarClosed
        }

        return 0
    }

    /**
     * Handles the phone speaker emit.
     *
     * @param playersToPhoneSpeaker - The players to send the phone speaker to.
     * @param playersOnPhoneSpeaker - The players who are on phone speaker.
     */
    handlePhoneSpeakerEmit(playersToPhoneSpeaker: Set<number>, playersOnPhoneSpeaker: Set<number>): void {
        if (this.useWhisper) {
            if (
                (this.phoneModule.phoneSpeakerActive && this.phoneModule.inCallWith.size) ||
                ((!this.phoneModule.phoneSpeakerActive || !this.phoneModule.inCallWith.size) && this.currentlySendingPhoneSpeakerSender.size)
            ) {
                const playersToNotReceivePhoneSpeaker = [...this.currentlySendingPhoneSpeakerSender].filter((playerId) => !playersToPhoneSpeaker.has(playerId))
                const playersNeedsReceivePhoneSpeaker = [...playersToPhoneSpeaker].filter((playerId) => !this.currentlySendingPhoneSpeakerSender.has(playerId))

                this.currentlySendingPhoneSpeakerSender = new Set(playersToPhoneSpeaker)

                if (playersNeedsReceivePhoneSpeaker.length || playersToNotReceivePhoneSpeaker.length) {
                    emitNet('server:yaca:phoneSpeakerEmitWhisper', playersNeedsReceivePhoneSpeaker, playersToNotReceivePhoneSpeaker)
                }
            }
        }

        for (const playerId of this.currentlyPhoneSpeakerApplied) {
            if (playersOnPhoneSpeaker.has(playerId)) {
                continue
            }

            this.currentlyPhoneSpeakerApplied.delete(playerId)
            const player = this.getPlayerByID(playerId)

            if (!player) {
                continue
            }

            this.setPlayersCommType(
                player,
                YacaFilterEnum.PHONE_SPEAKER,
                false,
                undefined,
                this.sharedConfig.maxPhoneSpeakerRange,
                CommDeviceMode.RECEIVER,
                CommDeviceMode.SENDER,
            )
        }
    }

    /**
     * Handles around phone emit.
     *
     * @param playerToHearOnPhone - The players to hear on the phone.
     */
    handlePhoneEmit(playerToHearOnPhone: Set<number>) {
        if (!this.sharedConfig.phoneHearPlayersNearby) return

        if (this.sharedConfig.phoneHearPlayersNearby === 'PHONE_SPEAKER') {
            if (
                !(
                    (this.phoneModule.phoneSpeakerActive && this.phoneModule.inCallWith.size) ||
                    ((!this.phoneModule.phoneSpeakerActive || !this.phoneModule.inCallWith.size) && this.phoneHearNearbyPlayer.size)
                )
            ) {
                return
            }
        } else {
            if (!(this.phoneModule.inCallWith.size || (!this.phoneModule.inCallWith.size && this.phoneHearNearbyPlayer.size))) {
                return
            }
        }

        const playersToNotHear = [...this.phoneHearNearbyPlayer].filter((playerId) => !playerToHearOnPhone.has(playerId))
        const playersToHear = [...playerToHearOnPhone].filter((playerId) => !this.phoneHearNearbyPlayer.has(playerId))

        this.phoneHearNearbyPlayer = new Set(playerToHearOnPhone)

        if (playersToHear.length || playersToNotHear.length) {
            emitNet('server:yaca:phoneEmit', playersToHear, playersToNotHear)
        }
    }

    /**
     * Handles the voice range adjustment using the mouse wheel.
     */
    handleVoiceRangeViaMouseWheel() {
        HudWeaponWheelIgnoreSelection()

        let newValue = 0
        const currentVoiceRange = this.getVoiceRange()

        if (IsControlPressed(0, 242)) {
            newValue = Math.max(1, currentVoiceRange - 1)
        } else if (IsControlPressed(0, 241)) {
            newValue = Math.min(this.sharedConfig.voiceRange.ranges[this.sharedConfig.voiceRange.ranges.length - 1], currentVoiceRange + 1)
        }

        if (newValue <= 0 || currentVoiceRange === newValue) return

        this.setVoiceRange(newValue)
    }

    /**
     * Calculate the players in streaming range and send them to the voice plugin.
     */
    // skipcq: JS-R1005
    calcPlayers() {
        const localData = this.getPlayerByID(cache.serverId)
        if (!localData) return

        const players = new Map<number, YacaPluginPlayerData>()
        const playersToPhoneSpeaker = new Set<number>()
        const playersOnPhoneSpeaker = new Set<number>()
        const playerToHearOnPhone = new Set<number>()

        let localPlayerPed = cache.ped
        let localPlayerVehicle = cache.vehicle

        if (this.spectatingPlayer) {
            const remotePlayerId = GetPlayerFromServerId(this.spectatingPlayer)

            if (remotePlayerId !== -1) {
                const remotePlayerPed = GetPlayerPed(remotePlayerId)
                if (remotePlayerPed !== 0) {
                    localPlayerPed = remotePlayerPed
                    const remotePlayerVehicle = GetVehiclePedIsIn(remotePlayerPed, false)
                    if (remotePlayerVehicle !== 0) {
                        localPlayerVehicle = remotePlayerVehicle
                    } else {
                        localPlayerVehicle = false
                    }
                }
            }
        }

        const localPos = GetEntityCoords(localPlayerPed, false)
        const currentRoom = GetRoomKeyFromEntity(localPlayerPed)
        const hasVehicleOpening = this.isFiveM ? this.checkIfVehicleHasOpening(localPlayerVehicle) : true
        const phoneSpeakerActive = this.phoneModule.phoneSpeakerActive && this.phoneModule.inCallWith.size

        for (const player of GetActivePlayers()) {
            // Get the remote ID of the player and check if it is the local player or the server.
            const remoteId = GetPlayerServerId(player)
            const playerPed = GetPlayerPed(player)
            // Check if the player is the local player and if the player is still in streaming range and the ped could be found.
            if (remoteId === 0 || remoteId === cache.serverId || playerPed <= 0) continue

            // Get the player data and check if the player is initialized and has a client ID set.
            const voiceSetting = this.getPlayerByID(remoteId)
            if (!voiceSetting || !voiceSetting.clientId) continue

            // Get the player state and the voice range of the player.
            const playerState = Player(remoteId).state
            const range = playerState[VOICE_RANGE_STATE_NAME] ?? this.defaultVoiceRange

            // Get the muffle intensity for the player.
            const muffleIntensity = this.getMuffleIntensity(
                localPlayerPed,
                playerPed,
                localPlayerVehicle,
                currentRoom,
                hasVehicleOpening,
                playerState[MEGAPHONE_STATE_NAME] !== null,
            )

            // Get the player position, the distance to the player, the player direction and if the player is underwater.
            const playerPos = GetEntityCoords(playerPed, false)
            const distanceToPlayer = calculateDistanceVec3(localPos, playerPos)
            const playerDirection = GetEntityForwardVector(playerPed)
            // @ts-expect-error Type error in the native
            const isUnderwater = IsPedSwimmingUnderWater(playerPed) === 1

            if (!playersOnPhoneSpeaker.has(remoteId)) {
                players.set(remoteId, {
                    client_id: voiceSetting.clientId,
                    position: convertNumberArrayToXYZ(playerPos),
                    direction: convertNumberArrayToXYZ(playerDirection),
                    range,
                    is_underwater: isUnderwater,
                    muffle_intensity: muffleIntensity,
                    is_muted: voiceSetting.forceMuted ?? false,
                })
            }

            // Who can be heard on the phone.
            if (this.sharedConfig.phoneHearPlayersNearby && !localData.mutedOnPhone && !voiceSetting.forceMuted && distanceToPlayer <= range) {
                if (this.sharedConfig.phoneHearPlayersNearby === 'PHONE_SPEAKER' && phoneSpeakerActive) {
                    playerToHearOnPhone.add(remoteId)
                } else if (this.sharedConfig.phoneHearPlayersNearby === true && this.phoneModule.inCallWith.size) {
                    playerToHearOnPhone.add(remoteId)
                }
            }

            // Check if the player is in phone speaker range.
            if (distanceToPlayer > this.sharedConfig.maxPhoneSpeakerRange) continue

            // Phone speaker handling - user who enabled it.
            if (this.useWhisper && phoneSpeakerActive) playersToPhoneSpeaker.add(remoteId)

            // If no phone speaker is active, skip the rest.
            if (!voiceSetting.phoneCallMemberIds) continue

            // Add all players which are in the call to the players list and give them the phone speaker effect.
            for (const phoneCallMemberId of voiceSetting.phoneCallMemberIds) {
                const phoneCallMember = this.getPlayerByID(phoneCallMemberId)
                if (!phoneCallMember || !phoneCallMember.clientId || phoneCallMember.mutedOnPhone || phoneCallMember.forceMuted) continue

                players.delete(phoneCallMemberId)
                players.set(phoneCallMemberId, {
                    client_id: phoneCallMember.clientId,
                    position: convertNumberArrayToXYZ(playerPos),
                    direction: convertNumberArrayToXYZ(playerDirection),
                    range: this.sharedConfig.maxPhoneSpeakerRange,
                    is_underwater: isUnderwater,
                    muffle_intensity: muffleIntensity,
                    is_muted: false,
                })

                playersOnPhoneSpeaker.add(phoneCallMemberId)

                if (this.currentlyPhoneSpeakerApplied.has(phoneCallMemberId)) continue

                this.setPlayersCommType(
                    phoneCallMember,
                    YacaFilterEnum.PHONE_SPEAKER,
                    true,
                    undefined,
                    this.sharedConfig.maxPhoneSpeakerRange,
                    CommDeviceMode.RECEIVER,
                    CommDeviceMode.SENDER,
                )

                this.currentlyPhoneSpeakerApplied.add(phoneCallMemberId)
            }
        }

        this.handlePhoneSpeakerEmit(playersToPhoneSpeaker, playersOnPhoneSpeaker)
        this.handlePhoneEmit(playerToHearOnPhone)

        // Send the collected data to the voice plugin.
        this.sendWebsocket({
            base: { request_type: 'INGAME' },
            player: {
                player_direction: getCamDirection(),
                player_position: convertNumberArrayToXYZ(localPos),
                player_range: LocalPlayer.state[VOICE_RANGE_STATE_NAME] ?? this.defaultVoiceRange,
                // @ts-expect-error Type error in the native
                player_is_underwater: IsPedSwimmingUnderWater(localPlayerPed) === 1,
                player_is_muted: localData.forceMuted ?? false,
                players_list: Array.from(players.values()),
            },
        })
    }
}
