import {
    clamp,
    GLOBAL_ERROR_LEVEL_STATE_NAME,
    initLocale,
    LIP_SYNC_STATE_NAME,
    loadConfig,
    locale,
    MEGAPHONE_STATE_NAME,
    parseJson5,
    VOICE_RANGE_STATE_NAME,
} from '@yaca-voice/common'
import {
    CommDeviceMode,
    type DataObject,
    defaultSharedConfig,
    defaultTowerConfig,
    type YacaClient,
    type YacaDisableableFilter,
    YacaEffectFilterEnum,
    YacaFilterEnum,
    YacaNotificationType,
    type YacaPlayerData,
    type YacaPluginPlayerData,
    YacaPluginStates,
    type YacaProtocol,
    type YacaResponse,
    type YacaRoomAcoustics,
    type YacaRoomAcousticsFile,
    type YacaSharedConfig,
    type YacaSoundStateMessage,
    type YacaSpeakerSettings,
    type YacaStereoMode,
    type YacaTowerConfig,
} from '@yaca-voice/types'
import { YaCAClientSaltyChatBridge } from '../bridge/saltychat'
import {
    cache,
    calculateDistanceVec3,
    convertNumberArrayToXYZ,
    displayRdrNotification,
    getCamDirection,
    getInteriorRoomPair,
    type InteriorRoomPair,
    joaat,
    OUTSIDE_ROOM_PAIR,
    playRdrFacialAnim,
    registerRdrKeyBind,
    toUInt32,
    vehicleHasOpening,
    WebSocket,
} from '../utils'
import { localLipSyncAnimations } from './data'
import { YaCAClientIntercomModule } from './intercom'
import { YaCAClientMegaphoneModule } from './megaphone'
import { YaCAClientMicrophoneModule } from './microphone'
import { YaCAClientPhoneModule } from './phone'
import { YaCAClientRadioModule } from './radio'

const ROOM_ACOUSTICS_FILE = 'config/room_acoustics.json5'
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

    disabledFilters: YacaDisableableFilter[] = []
    customRoomAcoustics: YacaRoomAcoustics[] = []
    teamSpeakUniqueIdentifier: string | undefined

    radioModule: YaCAClientRadioModule
    phoneModule: YaCAClientPhoneModule
    megaphoneModule: YaCAClientMegaphoneModule
    intercomModule: YaCAClientIntercomModule
    microphoneModule: YaCAClientMicrophoneModule

    saltyChatBridge?: YaCAClientSaltyChatBridge

    canChangeVoiceRange = true
    defaultVoiceRange = 1
    maxVoiceRange = -1
    rangeIndex: number
    rangeInterval: CitizenTimer | null = null
    visualVoiceRangeTimeout: CitizenTimer | null = null
    visualVoiceRangeTick: CitizenTimer | null = null
    voiceRangeViaMouseWheelTick: CitizenTimer | null = null
    voiceRangeChangeTimeout: CitizenTimer | null = null

    isTalking = false
    useWhisper = false
    spectatingPlayer: number | false = false
    notificationTimeout: Map<string, number> = new Map()

    isMicrophoneMuted = false
    isMicrophoneDisabled = false
    isSoundMuted = false
    isSoundDisabled = false

    currentlyPhoneSpeakerApplied = new Map<number, number>()
    currentlySendingPhoneSpeakerSender = new Set<number>()
    phoneHearNearbyPlayer = new Set<number>()
    currentlyAirborneApplied = new Set<number>()

    currentVoiceRange = this.defaultVoiceRange

    isFiveM = cache.game === 'fivem'
    isRedM = cache.game === 'redm'

    private currentPluginState: YacaPluginStates | undefined

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
        this.towerConfig = loadConfig<YacaTowerConfig>('config/towers.json5', defaultTowerConfig)
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

        this.disabledFilters = this.parseDisabledFilters(this.sharedConfig.disabledFilters)
        this.customRoomAcoustics = this.loadCustomRoomAcoustics()

        this.websocket = new WebSocket()
        this.setCurrentPluginState(YacaPluginStates.NOT_CONNECTED)

        /**
         * Register the NUI callback types.
         */
        RegisterNuiCallbackType('YACA_OnNuiReady')
        on('__cfx_nui:YACA_OnNuiReady', (_: unknown, cb: (data: unknown) => void) => {
            this.websocket.nuiReady = true
            this.websocket.initialized = false
            this.websocket.readyState = 0

            if (!this.firstConnect) {
                emitNet('server:yaca:nuiReady')
            } else if (this.sharedConfig.autoConnectOnJoin) {
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
        this.microphoneModule = new YaCAClientMicrophoneModule(this)
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

                const player = this.getPlayerByID(GetPlayerServerId(playerId))
                if (player) {
                    player.isTalking = value
                }
            })
        }

        /**
         * Add a state bag change handler for the global error level state bag.
         * Which is used to override the global error level.
         */
        AddStateBagChangeHandler(GLOBAL_ERROR_LEVEL_STATE_NAME, '', (_bagName: string, _key: string, _value: number, __: number) => {
            setImmediate(() => {
                this.phoneModule.enablePhoneCall(Array.from(this.phoneModule.inCallWith), true)
            })
        })

        if (this.sharedConfig.saltyChatBridge) {
            this.radioModule.secondaryRadioChannel = 2
            this.saltyChatBridge = new YaCAClientSaltyChatBridge(this)
        }

        AddStateBagChangeHandler(VOICE_RANGE_STATE_NAME, '', (bagName: string, _: string, value: number, __: number) => {
            const playerId = GetPlayerFromStateBagName(bagName)
            if (playerId !== cache.playerId) {
                return
            }

            this.currentVoiceRange = value
        })

        console.log('[Client] YaCA Client loaded.')
    }

    registerExports() {
        /**
         * Get the current voice range.
         *
         * @param {number} serverId - The remote ID of the player.
         * @returns {number} The current voice range.
         */
        exports('getVoiceRange', (serverId: number) => this.getVoiceRange(serverId))

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
         * Check if the player is currently talking.
         *
         * @param {number} serverId - The remote ID of the player.
         *
         * @returns {boolean} If the player is currently talking.
         */
        exports('isPlayerTalking', (serverId: number) => {
            const playerState = this.getPlayerByID(serverId)
            return playerState?.isTalking ?? false
        })

        /**
         * Enable or disable the voice range change function.
         *
         * @param {boolean} enable - If the voice range change function should be enabled or disabled.
         */
        exports('setVoiceRangeChangeAllowedState', (enable: boolean) => {
            this.canChangeVoiceRange = enable
        })

        /**
         * Get the voice range change allowed state.
         *
         * @returns {boolean} The voice range change allowed state.
         */
        exports('getVoiceRangeChangeAllowedState', () => this.canChangeVoiceRange)

        /**
         * Set the maximum voice range.
         *
         * @param {number} maxVoiceRange - The maximum voice range, -1 to disable.
         */
        exports('setMaxVoiceRange', (maxVoiceRange: number) => {
            this.maxVoiceRange = maxVoiceRange
        })

        /**
         * Get the maximum allowed voice range.
         *
         * @returns {number} The maximum voice range.
         */
        exports('getMaxVoiceRange', () => this.maxVoiceRange)

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
         * Get the TeamSpeak client unique identifier of the own client.
         *
         * @returns {string | undefined} The unique identifier, undefined if the plugin did not join yet.
         */
        exports('getTeamSpeakUniqueIdentifier', () => this.teamSpeakUniqueIdentifier)

        /**
         * Set a temporary volume factor for a player, e.g. for a whisper or shout system.
         *
         * @param {number} serverId - The remote ID of the player.
         * @param {number} volumeModifier - The volume factor, clamped to 0.1 - 2.0. 1.0 resets it.
         */
        exports('setPlayerVolumeModifier', (serverId: number, volumeModifier: number) => {
            this.setPlayerVolumeModifier(serverId, volumeModifier)
        })

        /**
         * Get the temporary volume factor of a player.
         *
         * @param {number} serverId - The remote ID of the player.
         * @returns {number} The volume factor, 1.0 if none is set.
         */
        exports('getPlayerVolumeModifier', (serverId: number) => this.getPlayerByID(serverId)?.volumeModifier ?? 1)

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

        /**
         *  Set the voice range marker color.
         *
         * @param {number} r - The red component of the color.
         * @param {number} g - The green component of the color.
         * @param {number} b - The blue component of the color.
         * @param {number} a - The alpha component of the color.
         */
        exports('setVoiceRangeMarkerColor', (r: number, g: number, b: number, a: number) => {
            if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || typeof a !== 'number') {
                console.error('[YaCA] Invalid color value in setVoiceRangeMarkerColor')
                return
            }

            this.sharedConfig.voiceRange.markerColor.r = r
            this.sharedConfig.voiceRange.markerColor.g = g
            this.sharedConfig.voiceRange.markerColor.b = b
            this.sharedConfig.voiceRange.markerColor.a = a
        })

        /**
         * Get the voice range marker color.
         *
         * @returns {number[]} The voice range marker color as an array of [r, g, b, a].
         */
        exports('getVoiceRangeMarkerColor', () => {
            const { r, g, b, a } = this.sharedConfig.voiceRange.markerColor
            return [r, g, b, a]
        })

        /**
         * Reset the voice range marker color to the default value.
         */
        exports('resetVoiceRangeMarkerColor', () => {
            const defaultColor = defaultSharedConfig.voiceRange.markerColor
            this.sharedConfig.voiceRange.markerColor.r = defaultColor.r
            this.sharedConfig.voiceRange.markerColor.g = defaultColor.g
            this.sharedConfig.voiceRange.markerColor.b = defaultColor.b
            this.sharedConfig.voiceRange.markerColor.a = defaultColor.a
        })
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

                this.websocket.removeAllListeners()

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
            const clientId = this.getPlayerByID(remoteId)?.clientId

            this.phoneModule.handleDisconnect(remoteId, clientId)
            this.radioModule.handleDisconnect(remoteId)
            this.currentlyAirborneApplied.delete(remoteId)
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
                    isTalking: currentData?.isTalking || false,
                    volumeModifier: dataObj.volumeModifier ?? currentData?.volumeModifier,
                })

                newPlayers.push(dataObj.playerId)
            }

            this.phoneModule.reestablishCalls(newPlayers)
            this.megaphoneModule.reestablishMegaphone(newPlayers)
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
         * Handles the "client:yaca:setPlayerVolumeModifier" server event.
         *
         * @param {number} target - The target to set the volume modifier for.
         * @param {number} volumeModifier - The volume factor, clamped to 0.1 - 2.0.
         */
        onNet('client:yaca:setPlayerVolumeModifier', (target: number, volumeModifier: number) => {
            this.setPlayerVolumeModifier(target, volumeModifier)
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
     * Set a temporary volume factor for a player.
     *
     * The plugin validates the value hard: a value outside of 0.1 - 2.0 makes it drop the whole position update of
     * that tick and answer with a general error, so the value is clamped here.
     *
     * @param serverId - The remote ID of the player.
     * @param volumeModifier - The volume factor, clamped to 0.1 - 2.0. 1.0 resets it.
     */
    setPlayerVolumeModifier(serverId: number, volumeModifier: number) {
        const player = this.getPlayerByID(serverId)
        if (!player) {
            return
        }

        if (typeof volumeModifier !== 'number' || Number.isNaN(volumeModifier)) {
            console.error(`[YaCA] Invalid volume modifier for player ${serverId}: ${volumeModifier}`)
            return
        }

        player.volumeModifier = clamp(volumeModifier, 0.1, 2)
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
     * Validates the configured disabled filters and drops unknown values.
     *
     * An unknown value would make the plugin reject the whole init request, so it is filtered out here.
     *
     * @param {string[]} filters - The filters from the shared config.
     * @returns {YacaDisableableFilter[]} The filters the plugin knows about.
     */
    parseDisabledFilters(filters: string[]): YacaDisableableFilter[] {
        const parsedFilters: YacaDisableableFilter[] = []

        for (const filter of filters ?? []) {
            if (filter in YacaFilterEnum || filter in YacaEffectFilterEnum) {
                parsedFilters.push(filter as YacaDisableableFilter)
                continue
            }

            console.error(`[YaCA] Unknown filter '${filter}' in disabledFilters, it will be ignored.`)
        }

        return parsedFilters
    }

    /**
     * Loads the room acoustics of the custom MLOs.
     *
     * The file ships with the resource and is produced by the "room-acoustics" tool. It is
     * sent to the plugin on init, where it is merged on top of the room acoustics the plugin ships with, so custom
     * rooms and overrides of stock rooms both work. The shipped file is empty, since the plugin already knows the
     * stock rooms - drop the output of the tool in to add your own MLOs.
     *
     * @returns {YacaRoomAcoustics[]} The room acoustics entries, empty if the file is missing or invalid.
     */
    loadCustomRoomAcoustics(): YacaRoomAcoustics[] {
        const fileData = LoadResourceFile(cache.resource, ROOM_ACOUSTICS_FILE)
        if (!fileData) {
            console.warn(`[YaCA] Could not read '${ROOM_ACOUSTICS_FILE}', custom MLOs will stay dry.`)
            return []
        }

        let parsedFile: YacaRoomAcousticsFile
        try {
            // JSON5 and not JSON.parse: the file ships as .json5 like every other config
            // here, and a single comment in it made the parse throw, which put this in the
            // catch below and sent the plugin an empty list - indistinguishable from a
            // server that has no custom MLOs at all
            parsedFile = parseJson5<YacaRoomAcousticsFile>(fileData)
        } catch (e) {
            console.error(`[YaCA] Error while parsing '${ROOM_ACOUSTICS_FILE}': `, e)
            return []
        }

        if (parsedFile?.version !== 1) {
            console.error(`[YaCA] Unexpected room acoustics file version '${parsedFile?.version}', expected 1.`)
            return []
        }

        const roomAcoustics: YacaRoomAcoustics[] = []
        for (const [interiorKeyString, interior] of Object.entries(parsedFile?.interiors ?? {})) {
            const interiorKey = toUInt32(Number.parseInt(interiorKeyString, 10))
            if (!interiorKey) {
                continue
            }

            for (const [roomKeyString, room] of Object.entries(interior?.rooms ?? {})) {
                const roomKey = toUInt32(Number.parseInt(roomKeyString, 10))
                if (!roomKey) {
                    continue
                }

                roomAcoustics.push({
                    interior_key: interiorKey,
                    room_key: roomKey,
                    small_send: clamp(room.small ?? 0, 0, 1),
                    medium_send: clamp(room.medium ?? 0, 0, 1),
                    large_send: clamp(room.large ?? 0, 0, 1),
                })
            }
        }

        return roomAcoustics
    }

    /**
     * Initializes the plugin.
     *
     * @param {DataObject} dataObj - The data object to initialize the plugin with.
     */
    initRequest(dataObj: DataObject) {
        if (!dataObj?.suid || typeof dataObj.chid !== 'number' || !dataObj.deChid || !dataObj.ingameName || typeof dataObj.channelPassword === 'undefined') {
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
            disabled_filters: this.disabledFilters,
            custom_room_acoustics: this.customRoomAcoustics,
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
                    const clientId = Number.parseInt(parsedPayload.message, 10)
                    // The JOIN response carries the TeamSpeak client unique identifier of the own client.
                    this.teamSpeakUniqueIdentifier = parsedPayload.additionalMessage || undefined

                    emitNet('server:yaca:addPlayer', clientId, this.teamSpeakUniqueIdentifier)

                    if (this.rangeInterval) {
                        clearInterval(this.rangeInterval)
                        this.rangeInterval = null
                    }

                    this.rangeInterval = setInterval(this.calcPlayers.bind(this), 250)

                    this.currentlyPhoneSpeakerApplied.clear()
                    this.currentlyAirborneApplied.clear()

                    // Set radio settings on reconnect only, else on first opening
                    if (this.radioModule.radioInitialized) {
                        this.radioModule.initRadioSettings()
                    }

                    emit('yaca:external:pluginInitialized', clientId, this.teamSpeakUniqueIdentifier)
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
            case 'WRONG_TS_SERVER': {
                this.setCurrentPluginState(YacaPluginStates.WRONG_TS_SERVER)

                const currentTimeout = this.notificationTimeout.get('WRONG_TS_SERVER')
                if (currentTimeout && currentTimeout > Date.now()) {
                    return
                }

                this.notificationTimeout.set('WRONG_TS_SERVER', Date.now() + 10000)
                this.notification(locale('wrong_ts_server') ?? 'You are connected to the wrong teamspeak server!', YacaNotificationType.ERROR)
                return
            }
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
     * @param {number} [serverId] - The remoteid of the player. If not provided, the local player's voice range is returned.
     * @returns {number} The current voice range.
     */
    getVoiceRange(serverId?: number): number {
        if (typeof serverId !== 'undefined') {
            const playerState = Player(serverId).state
            return playerState[VOICE_RANGE_STATE_NAME] ?? this.defaultVoiceRange
        }

        return this.currentVoiceRange ?? this.defaultVoiceRange
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
            const newIndex = this.sharedConfig.voiceRange.ranges.findIndex(
                (range) => ((this.maxVoiceRange !== -1 && range <= this.maxVoiceRange) || this.maxVoiceRange === -1) && range > currentVoiceRange,
            )
            this.rangeIndex = newIndex !== -1 ? newIndex : 0
        } else {
            const newIndex = this.sharedConfig.voiceRange.ranges
                .slice()
                .reverse()
                .findIndex((range) => range < currentVoiceRange)
            this.rangeIndex = newIndex !== -1 ? this.sharedConfig.voiceRange.ranges.length - 1 - newIndex : this.sharedConfig.voiceRange.ranges.length - 1

            // If maxrange is defined and the range is higher than maxrange, set the range to maxrange
            if (this.maxVoiceRange !== -1 && this.sharedConfig.voiceRange.ranges[this.rangeIndex] > this.maxVoiceRange) {
                const newIndex = this.sharedConfig.voiceRange.ranges
                    .slice()
                    .reverse()
                    .findIndex((range) => range <= this.maxVoiceRange)
                this.rangeIndex = newIndex !== -1 ? this.sharedConfig.voiceRange.ranges.length - 1 - newIndex : this.sharedConfig.voiceRange.ranges.length - 1
            }
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
        if (this.maxVoiceRange !== -1 && voiceRange > this.maxVoiceRange) return

        this.showRangeVisual(voiceRange)

        if (this.voiceRangeChangeTimeout) {
            clearTimeout(this.voiceRangeChangeTimeout)
        }

        this.currentVoiceRange = voiceRange
        this.voiceRangeChangeTimeout = setTimeout(() => {
            LocalPlayer.state.set(VOICE_RANGE_STATE_NAME, voiceRange, true)
            this.voiceRangeChangeTimeout = null
        }, 300)

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

            if (!this.isFiveM && this.sharedConfig.voiceRange.markerColor.type < 1000) {
                this.sharedConfig.voiceRange.markerColor.type = 0x94fdae17
                console.warn('[YaCA] Marker type is not supported in RedM. Using default marker type.')
            }

            this.visualVoiceRangeTick = setInterval(() => {
                const entity = cache.vehicle || cache.ped
                const pos = GetEntityCoords(entity, false)
                const posZ = (cache.vehicle ? pos[2] - 0.6 : pos[2] - 0.98) + (this.sharedConfig.voiceRange.markerColor.zOffset ?? 0)

                DrawMarker(
                    this.sharedConfig.voiceRange.markerColor.type,
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
                    this.sharedConfig.voiceRange.markerColor.rotate,
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
     * @param {YacaSpeakerSettings} speakerSettings - The fixed loudspeakers the device is heard from. Optional, the
     *                                               device is emitted from its owner when omitted. The positions belong
     *                                               to the channel, so all members of the channel share them. Sending
     *                                               `on: true` again for an already active channel updates them.
     * @param {number} speakerClient - The player whose device radiates this voice, when that is somebody other than
     *                                 the one speaking - a phone held on speaker by the other end of the call. The
     *                                 device stays carried and is emitted, muffled and ranged from that player, so
     *                                 this is not the field for a fixed array. Naming the speaker himself is the same
     *                                 as omitting it. Optional.
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
        speakerSettings?: YacaSpeakerSettings,
        speakerClient?: number | null,
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

        if (speakerSettings?.positions?.length) {
            protocol.speaker_positions = speakerSettings.positions.map((position) => (Array.isArray(position) ? convertNumberArrayToXYZ(position) : position))

            if (speakerSettings.interiorKey && speakerSettings.roomKey) {
                protocol.speaker_interior_key = toUInt32(speakerSettings.interiorKey)
                protocol.speaker_room_key = toUInt32(speakerSettings.roomKey)
            }
        }

        if (typeof speakerClient === 'number') {
            protocol.speaker_client_id = speakerClient
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

            if (!this.sharedConfig.useLocalLipSync) {
                LocalPlayer.state.set(LIP_SYNC_STATE_NAME, isTalking, true)
            }

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

        if (!player?.remoteID) {
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
        const targetRoom = GetRoomKeyFromEntity(nearbyPlayerPed)
        if (ownCurrentRoom !== targetRoom && !HasEntityClearLosToEntity(playerPed, nearbyPlayerPed, 17)) {
            if (targetRoom !== 0 && this.sharedConfig.mufflingSettings.whitelistedRoomIds.includes(targetRoom)) {
                return 0
            }

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
     * Whether a nearby player actually reaches this one through the game world - his voice range
     * and the occlusion between the two.
     *
     * @param {number} distance - Distance between the two players.
     * @param {number} range - The other player's voice range.
     * @param {number} muffleIntensity - What getMuffleIntensity() measured between the two.
     * @param {number} verticalDistance - Height difference between the two.
     */
    canHearThroughWorld(distance: number, range: number, muffleIntensity: number, verticalDistance: number): boolean {
        if (distance > range) {
            return false
        }

        if (muffleIntensity <= 0) {
            return true
        }

        const mufflingRange = this.sharedConfig.mufflingSettings.mufflingRange

        return verticalDistance < 3 && (mufflingRange < 0 || distance < mufflingRange)
    }

    /**
     * Handles the phone speaker emit.
     *
     * @param playersToPhoneSpeaker - The players to send the phone speaker to.
     * @param phoneSpeakerHolders - The players who are on phone speaker, mapped to the client id of the handset
     *                              radiating them.
     */
    handlePhoneSpeakerEmit(playersToPhoneSpeaker: Set<number>, phoneSpeakerHolders: Map<number, number>): void {
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

        for (const [playerId, holderClientId] of phoneSpeakerHolders) {
            if (this.currentlyPhoneSpeakerApplied.get(playerId) === holderClientId) {
                continue
            }

            const player = this.getPlayerByID(playerId)

            if (!player?.clientId) {
                continue
            }

            this.setPlayersCommType(
                player,
                YacaFilterEnum.PHONE_SPEAKER,
                true,
                undefined,
                this.sharedConfig.maxPhoneSpeakerRange,
                CommDeviceMode.RECEIVER,
                CommDeviceMode.SENDER,
                undefined,
                undefined,
                holderClientId,
            )

            this.currentlyPhoneSpeakerApplied.set(playerId, holderClientId)
        }

        for (const playerId of this.currentlyPhoneSpeakerApplied.keys()) {
            if (phoneSpeakerHolders.has(playerId)) {
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
     * Whether the airborne filter is enabled. It needs a plugin build that knows the filter.
     */
    get airborneEnabled(): boolean {
        return this.sharedConfig.airborne.enabled && this.isFiveM
    }

    /**
     * Checks whether a vehicle counts as an aircraft for the airborne filter.
     *
     * @param vehicle - The vehicle to check.
     * @returns {boolean} Whether the vehicle is an aircraft.
     */
    isAirborneVehicle(vehicle: number | false): boolean {
        if (!this.airborneEnabled || !vehicle) {
            return false
        }

        return this.sharedConfig.airborne.vehicleClasses.includes(GetVehicleClass(vehicle))
    }

    /**
     * Applies and removes the airborne filter for the crew of the local aircraft.
     *
     * The filter only sits between players sharing the same aircraft. Someone standing outside is not part of the
     * crew and keeps the normal voice, which is why the vehicle has to match and not just the airborne state.
     *
     * @param crewMembers - The players sitting in the same aircraft as the local player.
     */
    handleAirborneEmit(crewMembers: Set<number>) {
        for (const playerId of this.currentlyAirborneApplied) {
            if (crewMembers.has(playerId)) {
                continue
            }

            this.currentlyAirborneApplied.delete(playerId)

            const player = this.getPlayerByID(playerId)
            if (!player) {
                continue
            }

            this.setPlayersCommType(player, YacaFilterEnum.AIRBORNE, false, undefined, undefined, CommDeviceMode.TRANSCEIVER, CommDeviceMode.TRANSCEIVER)
        }

        for (const playerId of crewMembers) {
            if (this.currentlyAirborneApplied.has(playerId)) {
                continue
            }

            const player = this.getPlayerByID(playerId)
            if (!player) {
                continue
            }

            this.setPlayersCommType(player, YacaFilterEnum.AIRBORNE, true, undefined, undefined, CommDeviceMode.TRANSCEIVER, CommDeviceMode.TRANSCEIVER)
            this.currentlyAirborneApplied.add(playerId)
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
        if (this.isFiveM) {
            HudWeaponWheelIgnoreSelection()
        }

        let newValue = 0
        const currentVoiceRange = this.getVoiceRange()

        if (IsControlPressed(0, 242)) {
            newValue = Math.max(1, currentVoiceRange - 1)
        } else if (IsControlPressed(0, 241)) {
            newValue = Math.min(this.sharedConfig.voiceRange.ranges[this.sharedConfig.voiceRange.ranges.length - 1], currentVoiceRange + 1)

            if (this.maxVoiceRange !== -1 && newValue > this.maxVoiceRange) {
                newValue = this.maxVoiceRange
            }
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
        const phoneSpeakerHolders = new Map<number, number>()
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
        const localVehicleEncloses = this.vehicleEnclosesFromRoom(localPlayerVehicle)
        const localRoomPair = this.getRoomPair(localPlayerPed, localVehicleEncloses)
        const hasVehicleOpening = this.isFiveM ? this.checkIfVehicleHasOpening(localPlayerVehicle) : true
        const phoneSpeakerActive = this.phoneModule.phoneSpeakerActive && this.phoneModule.inCallWith.size
        const localVehicleIsAirborne = this.isAirborneVehicle(localPlayerVehicle)
        const airborneCrewMembers = new Set<number>()

        for (const player of GetActivePlayers()) {
            // Get the remote ID of the player and check if it is the local player or the server.
            const remoteId = GetPlayerServerId(player)
            const playerPed = GetPlayerPed(player)
            // Check if the player is the local player and if the player is still in streaming range and the ped could be found.
            if (remoteId === 0 || remoteId === cache.serverId || playerPed <= 0) continue

            // Get the player data and check if the player is initialized and has a client ID set.
            const voiceSetting = this.getPlayerByID(remoteId)
            if (!voiceSetting?.clientId) continue

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
            const playerVehicle = GetVehiclePedIsIn(playerPed, false)
            const sharesLocalVehicle = Boolean(localPlayerVehicle) && playerVehicle === localPlayerVehicle
            const playerRoomPair = this.getRoomPair(playerPed, sharesLocalVehicle && localVehicleEncloses)

            if (localVehicleIsAirborne && sharesLocalVehicle) {
                airborneCrewMembers.add(remoteId)
            }

            const obj: YacaPluginPlayerData = {
                client_id: voiceSetting.clientId,
                position: convertNumberArrayToXYZ(playerPos),
                direction: convertNumberArrayToXYZ(playerDirection),
                range,
                is_underwater: isUnderwater,
                muffle_intensity: muffleIntensity,
                is_muted: voiceSetting.forceMuted ?? false,
                volume_modifier: typeof voiceSetting.volumeModifier === 'number' ? voiceSetting.volumeModifier : undefined,
            }

            if (playerRoomPair.interiorKey && playerRoomPair.roomKey) {
                obj.interior_key = playerRoomPair.interiorKey
                obj.room_key = playerRoomPair.roomKey
            }

            players.set(remoteId, obj)

            // Who can be heard on the phone. What the phone picks up is what we hear ourselves,
            // occlusion included - see canHearThroughWorld
            if (
                this.sharedConfig.phoneHearPlayersNearby &&
                !localData.mutedOnPhone &&
                !voiceSetting.forceMuted &&
                this.canHearThroughWorld(distanceToPlayer, range, muffleIntensity, Math.abs(localPos[2] - playerPos[2]))
            ) {
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
                if (!phoneCallMember?.clientId || phoneCallMember.mutedOnPhone || phoneCallMember.forceMuted) continue

                if (!phoneSpeakerHolders.has(phoneCallMemberId) || this.currentlyPhoneSpeakerApplied.get(phoneCallMemberId) === voiceSetting.clientId) {
                    phoneSpeakerHolders.set(phoneCallMemberId, voiceSetting.clientId)
                }
            }
        }

        this.handlePhoneSpeakerEmit(playersToPhoneSpeaker, phoneSpeakerHolders)
        this.handlePhoneEmit(playerToHearOnPhone)
        this.handleAirborneEmit(airborneCrewMembers)

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
                room_key: localRoomPair.roomKey || undefined,
                interior_key: localRoomPair.interiorKey || undefined,
            },
        })
    }

    /**
     * Get the (interior, room) pair of a ped, which the plugin uses to resolve the room acoustics.
     *
     * A closed cabin keeps the voice out of the room, so a voice that never leaves it stays dry. Whether that is the
     * case depends on the listener: for another player it is only true while both share the cabin, for the own
     * self monitored voice it is true as soon as the local player sits in one.
     *
     * @param ped - The ped to get the pair for.
     * @param isolatedFromRoom - Whether the voice stays inside a cabin instead of travelling through the room.
     * @returns {InteriorRoomPair} The pair, `OUTSIDE_ROOM_PAIR` outside of an interior, inside a cabin and in RedM.
     */
    getRoomPair(ped: number, isolatedFromRoom = false): InteriorRoomPair {
        if (!this.isFiveM || isolatedFromRoom) {
            return OUTSIDE_ROOM_PAIR
        }

        return getInteriorRoomPair(ped)
    }

    /**
     * Checks whether a vehicle encloses its occupants enough to keep their voice out of the room it stands in.
     *
     * Not every vehicle does. A motorcycle or a bicycle has no cabin at all, so its rider is acoustically standing in
     * the room and has to keep its reverb.
     *
     * @param vehicle - The vehicle to check, false when the player is on foot.
     * @returns {boolean} Whether the vehicle shuts its occupants off from the room.
     */
    vehicleEnclosesFromRoom(vehicle: number | false): boolean {
        if (!this.isFiveM || !vehicle) {
            return false
        }

        return !this.sharedConfig.reverb.openVehicleClasses.includes(GetVehicleClass(vehicle))
    }
}
