import { locale } from '@yaca-voice/common'
import { triggerClientEvent } from '../utils/events'
import type { YaCAServerModule } from './main'

/**
 * The ghosting module for the server.
 *
 * Ghosting lets a player be heard by everybody inside his reach as if he stood next to them, without the two clients
 * streaming each other in. That reaches past everything the world would otherwise put between the two, so the state
 * lives here and not on the client: a client only reports which of the players around it are in reach, and that
 * report is ignored unless the server has put the player into ghosting beforehand.
 */
export class YaCAServerGhostingModule {
    private serverModule: YaCAServerModule

    private ghostedPlayers = new Map<number, Set<number>>()

    /**
     * Creates an instance of the ghosting module.
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
         * Handles the "server:yaca:ghosting" event.
         *
         * @param {number[]} startGhosting - The players which came into reach of the ghost.
         * @param {number[]} stopGhosting - The players which left the reach of the ghost.
         */
        onNet('server:yaca:ghosting', (startGhosting?: number[], stopGhosting?: number[]) => {
            const player = this.serverModule.getPlayer(source)
            if (!player) {
                return
            }

            if (stopGhosting?.length) {
                this.stopGhostingFor(source, stopGhosting)
            }

            if (!startGhosting?.length || !player.voiceSettings.ghosting) {
                return
            }

            const targets = this.ghostedPlayers.get(source) ?? new Set<number>()
            const newTargets: number[] = []

            for (const targetId of startGhosting) {
                if (targetId === source || targets.has(targetId)) {
                    continue
                }

                if (!this.serverModule.getPlayer(targetId)?.voicePlugin) {
                    continue
                }

                targets.add(targetId)
                newTargets.push(targetId)
            }

            if (!newTargets.length) {
                return
            }

            this.ghostedPlayers.set(source, targets)

            triggerClientEvent('client:yaca:ghosting', newTargets, source, true)
        })
    }

    /**
     * Register server exports.
     */
    registerExports() {
        /**
         * Put a player into ghosting or take him out of it again.
         *
         * @param {number} playerId - The ID of the player.
         * @param {boolean} state - Whether the player is ghosting.
         * @param {number | false} [range] - A fixed reach. Omitted, it follows his voice range.
         */
        exports('setPlayerGhosting', (playerId: number, state: boolean, range?: number | false) => this.setPlayerGhosting(playerId, state, range))

        /**
         * Whether a player is ghosting.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {boolean} - The ghosting state.
         */
        exports('isPlayerGhosting', (playerId: number) => this.serverModule.getPlayer(playerId)?.voiceSettings.ghosting ?? false)

        /**
         * Set how far a ghost reaches, without touching his ghosting state.
         *
         * @param {number} playerId - The ID of the player.
         * @param {number | false} range - A fixed range, false to follow his own voice range again.
         */
        exports('setPlayerGhostingRange', (playerId: number, range: number | false) => this.setPlayerGhostingRange(playerId, range))

        /**
         * Get how far a ghost reaches.
         *
         * @param {number} playerId - The ID of the player.
         * @returns {number | false} - The ghosting range, false when it follows his voice range.
         */
        exports('getPlayerGhostingRange', (playerId: number) => this.serverModule.getPlayer(playerId)?.voiceSettings.ghostingRange ?? false)

        /**
         * Get the players a ghost is currently heard by.
         *
         * @param {number} playerId - The ID of the ghost.
         * @returns {number[]} - The IDs of the players in reach of the ghost.
         */
        exports('getGhostedPlayers', (playerId: number) => [...(this.ghostedPlayers.get(playerId) ?? [])])
    }

    /**
     * Put a player into ghosting or take him out of it again.
     *
     * A ghost rarely stands where he talks - txAdmin parks the ped of a spectating admin 15 metres below his target -
     * so the reach is measured from the position he listens from, which is the spectated player while spectating.
     *
     * Without a range the reach follows the voice range of the ghost and keeps following it, so he widens and narrows
     * it himself with the normal voice range keys while ghosting. A fixed range is for a ghost who should cover a set
     * area no matter what he has his own voice range on.
     *
     * @param {number} src - The source-id of the player.
     * @param {boolean} state - Whether the player is ghosting.
     * @param {number | false} [range] - A fixed range. Omitted, the reach follows his own voice range.
     */
    setPlayerGhosting(src: number, state: boolean, range?: number | false) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            console.error(locale('player_not_found', src))
            return
        }

        const ghostingRange = state ? this.clampRange(range) : undefined

        if (player.voiceSettings.ghosting === state && player.voiceSettings.ghostingRange === ghostingRange) {
            return
        }

        player.voiceSettings.ghosting = state
        player.voiceSettings.ghostingRange = ghostingRange

        if (!state) {
            this.stopGhostingFor(src)
        }

        emitNet('client:yaca:setGhosting', src, state, ghostingRange)
        emit('yaca:external:ghostingState', src, state, ghostingRange)
    }

    /**
     * Set how far a ghost reaches, without touching his ghosting state. The range belongs to the ghosting session, so
     * this does nothing for a player who is not ghosting.
     *
     * @param {number} src - The source-id of the player.
     * @param {number | false} range - A fixed range, false to follow his own voice range again.
     */
    setPlayerGhostingRange(src: number, range: number | false) {
        const player = this.serverModule.getPlayer(src)
        if (!player) {
            console.error(locale('player_not_found', src))
            return
        }

        this.setPlayerGhosting(src, player.voiceSettings.ghosting, range)
    }

    /**
     * A fixed range capped at the largest configured voice range, or undefined for a reach which follows the voice
     * range of the ghost. Capped here and not on the client so that both ends report the same number.
     *
     * @param {number | false} [range] - The range as it was passed in.
     */
    private clampRange(range?: number | false): number | undefined {
        if (typeof range !== 'number' || range <= 0) {
            return undefined
        }

        return Math.min(range, Math.max(...this.serverModule.sharedConfig.voiceRange.ranges))
    }

    /**
     * Takes a ghost out of the ear of the given players, all of them when none are named.
     *
     * @param {number} src - The source-id of the ghost.
     * @param {number[]} [targetIds] - The players to stop ghosting.
     */
    private stopGhostingFor(src: number, targetIds?: number[]) {
        const targets = this.ghostedPlayers.get(src)
        if (!targets?.size) {
            return
        }

        const droppedTargets: number[] = []

        for (const targetId of targetIds ?? [...targets]) {
            if (targets.delete(targetId)) {
                droppedTargets.push(targetId)
            }
        }

        if (!targets.size) {
            this.ghostedPlayers.delete(src)
        }

        triggerClientEvent('client:yaca:ghosting', droppedTargets, src, false)
    }

    /**
     * Drops every ghosting relation the given player takes part in, in either of the two roles.
     *
     * @param {number} playerId - The player leaving.
     */
    handlePlayerDisconnect(playerId: number) {
        this.stopGhostingFor(playerId)

        for (const targets of this.ghostedPlayers.values()) {
            targets.delete(playerId)
        }
    }
}
