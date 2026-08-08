import { CommDeviceMode, YacaFilterEnum, type YacaMicrophoneSettings, type YacaSpeakerSettings, type YacaVector3 } from '@yaca-voice/types'
import { cache, convertNumberArrayToXYZ, getInteriorRoomPairAtCoords, type InteriorRoomPair, OUTSIDE_ROOM_PAIR } from '../utils'
import type { YaCAClientModule } from './main'

export class YaCAClientMicrophoneModule {
    clientModule: YaCAClientModule

    /**
     * Creates an instance of the microphone module.
     *
     * @param clientModule - The client module.
     */
    constructor(clientModule: YaCAClientModule) {
        this.clientModule = clientModule

        this.registerEvents()
    }

    registerEvents() {
        /**
         * Handles the "client:yaca:microphone" server event.
         *
         * @param {number} target - The player at the microphone.
         * @param {boolean} state - Whether the microphone is turned on or off.
         * @param {YacaMicrophoneSettings} settings - The loudspeakers, their room and the range. Optional, without
         *                                           loudspeakers the voice is emitted from the player holding it.
         *                                           Sending it again while on updates the loudspeakers and the range.
         */
        onNet('client:yaca:microphone', (target: number, state: boolean, settings?: YacaMicrophoneSettings) => {
            const speakerSettings = this.buildSpeakerSettings(settings)

            if (target === cache.serverId) {
                this.clientModule.setPlayersCommType(
                    [],
                    YacaFilterEnum.MICROPHONE,
                    state,
                    undefined,
                    settings?.range,
                    CommDeviceMode.SENDER,
                    CommDeviceMode.RECEIVER,
                    undefined,
                    speakerSettings,
                )

                emit('yaca:external:microphoneState', state)
                return
            }

            const player = this.clientModule.getPlayerByID(target)
            if (!player) {
                return
            }

            this.clientModule.setPlayersCommType(
                player,
                YacaFilterEnum.MICROPHONE,
                state,
                undefined,
                settings?.range,
                CommDeviceMode.RECEIVER,
                CommDeviceMode.SENDER,
                undefined,
                speakerSettings,
            )
        })
    }

    /**
     * Builds the loudspeaker settings of a microphone.
     *
     * @param settings - The settings sent by the server.
     * @returns {YacaSpeakerSettings | undefined} The loudspeaker settings, undefined when the microphone has none.
     */
    buildSpeakerSettings(settings?: YacaMicrophoneSettings): YacaSpeakerSettings | undefined {
        const positions = settings?.positions
        if (!positions?.length) {
            return undefined
        }

        if (settings?.interiorKey && settings.roomKey) {
            return { positions, interiorKey: settings.interiorKey, roomKey: settings.roomKey }
        }

        const roomPair = this.resolveSpeakerRoomPair(positions[0])

        return { positions, interiorKey: roomPair.interiorKey, roomKey: roomPair.roomKey }
    }

    /**
     * Resolves the room the loudspeakers stand in.
     *
     * @param position - The position of a loudspeaker.
     * @returns {InteriorRoomPair} The room of the loudspeakers, zeroed when neither source resolves one.
     */
    resolveSpeakerRoomPair(position: YacaVector3 | number[]): InteriorRoomPair {
        if (!this.clientModule.isFiveM) {
            return OUTSIDE_ROOM_PAIR
        }

        const coords = Array.isArray(position) ? convertNumberArrayToXYZ(position) : position

        const speakerRoomPair = getInteriorRoomPairAtCoords(coords)
        if (speakerRoomPair.interiorKey && speakerRoomPair.roomKey) {
            return speakerRoomPair
        }

        return this.clientModule.getRoomPair(cache.ped)
    }
}
