import type { YacaPluginPlayerData, YacaVector3 } from '@yaca-voice/types'
import type { InteriorRoomPair } from '../utils'
import type { YaCAClientModule } from './main'

const GHOST_DIRECTION: YacaVector3 = { x: 0, y: 0, z: 0 }

/**
 * The ghosting module for the client.
 *
 * A ghosting player - an invisible admin, someone being spectated - hears everybody inside his ghosting range at
 * that range and is heard by them as if he stood right next to them: no distance, no direction, no muffling and no
 * room between the two. It works in both directions without the two clients streaming each other in, because the
 * relation is relayed over the server instead of being derived from the entities around.
 */
export class YaCAClientGhostingModule {
    clientModule: YaCAClientModule

    isGhosting = false
    ghostingRange: number | undefined
    ghostedPlayers = new Set<number>()
    ghostsAround = new Set<number>()

    /**
     * Creates an instance of the ghosting module.
     *
     * @param clientModule - The client module.
     */
    constructor(clientModule: YaCAClientModule) {
        this.clientModule = clientModule

        this.registerEvents()
        this.registerExports()
    }

    registerEvents() {
        /**
         * Handles the "client:yaca:setGhosting" server event.
         *
         * @param {boolean} state - Whether the local player is ghosting.
         */
        onNet('client:yaca:setGhosting', (state: boolean, range?: number) => {
            this.setGhosting(state, range)
        })

        /**
         * Handles the "client:yaca:ghosting" server event.
         *
         * @param {number} ghostId - The remote ID of the player ghosting the local player.
         * @param {boolean} state - Whether the player starts or stops ghosting the local player.
         */
        onNet('client:yaca:ghosting', (ghostId: number, state: boolean) => {
            if (state) {
                this.ghostsAround.add(ghostId)
            } else {
                this.ghostsAround.delete(ghostId)
            }
        })
    }

    registerExports() {
        /**
         * Whether the local player is currently ghosting.
         *
         * @returns {boolean} The ghosting state.
         */
        exports('isGhosting', () => this.isGhosting)

        /**
         * Get how far the local player reaches while ghosting.
         *
         * @returns {number} The ghosting range, the current voice range if ghosting was not given a fixed one.
         */
        exports('getGhostingRange', () => this.reach)

        /**
         * Get the players the local player is currently ghosting.
         *
         * @returns {number[]} The remote IDs of the ghosted players.
         */
        exports('getGhostedPlayers', () => [...this.ghostedPlayers])
    }

    /**
     * How far the ghost reaches around the position he listens from.
     *
     * A ghost is normally somewhere else than the people he talks to - txAdmin parks the ped of a spectating admin
     * 15 metres below his target - so the reach is measured from the spectated player and not from his own ped.
     *
     * Read fresh every tick, so without a fixed range the ghost widens and narrows his reach himself with the normal
     * voice range keys while he is ghosting.
     */
    get reach(): number {
        return this.ghostingRange ?? this.clientModule.currentVoiceRange
    }

    /**
     * Sets the ghosting state of the local player.
     *
     * The server owns this state, it is only mirrored here - it validates and caps the range and only sends a change,
     * so there is nothing left to check on this end.
     *
     * @param {boolean} state - Whether the local player is ghosting.
     * @param {number} [range] - A fixed range. Omitted, the reach follows his own voice range.
     */
    setGhosting(state: boolean, range?: number) {
        this.isGhosting = state
        this.ghostingRange = range

        emit('yaca:external:ghostingState', state, this.reach)
    }

    /**
     * Whether a player in streaming range is ghosted by the local player.
     *
     * @param {number} distance - The distance to the player.
     * @param {boolean} forceMuted - Whether the player is force muted.
     * @returns {boolean} Whether the player is ghosted.
     */
    isPlayerGhosted(distance: number, forceMuted?: boolean): boolean {
        return this.isGhosting && !forceMuted && distance <= this.reach
    }

    /**
     * Tells the server which players the local player ghosts, so they can hear him.
     *
     * Only the changes are sent, and the last set is still sent after ghosting was turned off, or the players around
     * would keep the ghost in their ear for the rest of the session.
     *
     * @param {Set<number>} playersToGhost - The players in reach of the ghost this tick.
     */
    handleGhostingEmit(playersToGhost: Set<number>) {
        if (!playersToGhost.size && !this.ghostedPlayers.size) {
            return
        }

        const stopGhosting = [...this.ghostedPlayers].filter((playerId) => !playersToGhost.has(playerId))
        const startGhosting = [...playersToGhost].filter((playerId) => !this.ghostedPlayers.has(playerId))

        this.ghostedPlayers = new Set(playersToGhost)

        if (startGhosting.length || stopGhosting.length) {
            emitNet('server:yaca:ghosting', startGhosting, stopGhosting)
        }
    }

    /**
     * Puts the players ghosting the local player into the player list, on top of the listener.
     *
     * The entry replaces the one the streaming loop may have written, and is added for ghosts which are not streamed
     * in at all. Position, direction, muffling and room are the listener's own, so nothing between the two attenuates
     * the voice.
     *
     * @param {Map<number, YacaPluginPlayerData>} players - The player list of this tick.
     * @param {YacaVector3} localPos - The position the listener hears from.
     * @param {InteriorRoomPair} localRoomPair - The room the listener hears from.
     */
    addGhostsToPlayerList(players: Map<number, YacaPluginPlayerData>, localPos: YacaVector3, localRoomPair: InteriorRoomPair) {
        for (const ghostId of this.ghostsAround) {
            const ghost = this.clientModule.getPlayerByID(ghostId)
            if (!ghost?.clientId) {
                continue
            }

            const obj: YacaPluginPlayerData = {
                client_id: ghost.clientId,
                position: localPos,
                direction: GHOST_DIRECTION,
                range: this.clientModule.getVoiceRange(ghostId),
                is_underwater: false,
                muffle_intensity: 0,
                is_muted: ghost.forceMuted ?? false,
                volume_modifier: typeof ghost.volumeModifier === 'number' ? ghost.volumeModifier : undefined,
            }

            if (localRoomPair.interiorKey && localRoomPair.roomKey) {
                obj.interior_key = localRoomPair.interiorKey
                obj.room_key = localRoomPair.roomKey
            }

            players.set(ghostId, obj)
        }
    }

    /**
     * Handles the disconnect of a player, in either of the two roles.
     *
     * Dropping the player from the ghosted set is what makes a rejoining player under the same ID be ghosted again -
     * the emit only ever sends the changes against that set.
     *
     * @param {number} remoteId - The remote ID of the player who left.
     */
    handleDisconnect(remoteId: number) {
        this.ghostedPlayers.delete(remoteId)
        this.ghostsAround.delete(remoteId)
    }
}
