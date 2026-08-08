import { CommDeviceMode, YacaFilterEnum, type YacaPlayerData, type YacaSpeakerSettings } from '@yaca-voice/types'
import type { YaCAClientModule } from './main'

/**
 * The intercom module for the client.
 */
export class YaCAClientIntercomModule {
    clientModule: YaCAClientModule

    /**
     * Creates an instance of the intercom module.
     *
     * @param clientModule - The client module.
     */
    constructor(clientModule: YaCAClientModule) {
        this.clientModule = clientModule

        this.registerEvents()
    }

    /**
     * Register the intercom events.
     */
    registerEvents() {
        /**
         * Handles the "client:yaca:addRemovePlayerIntercomFilter" server event.
         *
         * @param {number[] | number} playerIDs - The IDs of the players to be added or removed from the intercom filter.
         * @param {boolean} state - The state indicating whether to add or remove the players.
         * @param {YacaSpeakerSettings} speakerSettings - The fixed loudspeakers the intercom is heard from, e.g. an
         *                                               intercom with several horns. Optional, the intercom is heard
         *                                               from its owner when omitted.
         */
        onNet('client:yaca:addRemovePlayerIntercomFilter', (playerIDs: number | number[], state: boolean, speakerSettings?: YacaSpeakerSettings) => {
            if (!Array.isArray(playerIDs)) {
                playerIDs = [playerIDs]
            }

            const playersToAddRemove: Set<YacaPlayerData> = new Set()
            for (const playerID of playerIDs) {
                const player = this.clientModule.getPlayerByID(playerID)
                if (!player) {
                    continue
                }
                playersToAddRemove.add(player)
            }

            if (playersToAddRemove.size < 1) {
                return
            }
            this.clientModule.setPlayersCommType(
                Array.from(playersToAddRemove),
                YacaFilterEnum.INTERCOM,
                state,
                undefined,
                undefined,
                CommDeviceMode.TRANSCEIVER,
                CommDeviceMode.TRANSCEIVER,
                undefined,
                speakerSettings,
            )
        })
    }
}
