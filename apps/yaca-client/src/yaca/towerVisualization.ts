import { locale } from '@yaca-voice/common'
import { cache, calculateDistanceVec3 } from '../utils'
import type { YaCAClientRadioModule } from './radio'

interface YacaTowerCoverageZone {
    radius: number
    blipColor: number
    blipAlpha: number
    r: number
    g: number
    b: number
}

/**
 * The tower visualization module for the client.
 */
export class YaCAClientTowerVisualizationModule {
    radioModule: YaCAClientRadioModule

    enabled = false

    blips: number[] = []
    markerTick: CitizenTimer | null = null

    /**
     * The coverage zones, sorted ascending by radius.
     */
    zones: YacaTowerCoverageZone[] = []

    /**
     * Creates an instance of the tower visualization module.
     *
     * @param radioModule - The radio module.
     */
    constructor(radioModule: YaCAClientRadioModule) {
        this.radioModule = radioModule

        this.registerExports()
        this.registerEvents()

        if (this.config.enabled) {
            this.setTowerVisualization(true)
        }
    }

    /**
     * The tower visualization settings from the shared config.
     */
    get config() {
        return this.radioModule.clientModule.sharedConfig.towerVisualization
    }

    /**
     * The tower positions which are currently in use.
     */
    get towerPositions() {
        return this.radioModule.clientModule.towerConfig.towerPositions
    }

    /**
     * Registers the exports for the tower visualization module.
     */
    registerExports() {
        /**
         * Enables or disables the tower visualization.
         *
         * @param {boolean} state - The state of the tower visualization.
         * @returns {boolean} The state of the tower visualization.
         */
        exports('setTowerVisualization', (state: boolean) => this.setTowerVisualization(state))

        /**
         * Toggles the tower visualization.
         *
         * @returns {boolean} The state of the tower visualization.
         */
        exports('toggleTowerVisualization', () => this.setTowerVisualization(!this.enabled))

        /**
         * Returns the state of the tower visualization.
         *
         * @returns {boolean} The state of the tower visualization.
         */
        exports('isTowerVisualizationEnabled', () => this.enabled)
    }

    /**
     * Registers the events for the tower visualization module.
     */
    registerEvents() {
        /**
         * Handles the "onResourceStop" event, so no blips are left behind on the map.
         *
         * @param {string} resourceName - The name of the resource that has stopped.
         */
        on('onResourceStop', (resourceName: string) => {
            if (cache.resource !== resourceName) {
                return
            }

            this.setTowerVisualization(false)
        })
    }

    /**
     * Enable or disable the tower visualization.
     *
     * @param {boolean} state - The state of the tower visualization.
     *
     * @returns {boolean} The state of the tower visualization.
     */
    setTowerVisualization(state: boolean): boolean {
        if (this.enabled === state) {
            return this.enabled
        }

        this.enabled = state

        if (state) {
            this.zones = this.calculateZones()

            this.createBlips()
            this.startMarkerTick()
        } else {
            this.removeBlips()
            this.stopMarkerTick()
        }

        return this.enabled
    }

    /**
     * Redraw the visualization, used when the towers have changed.
     */
    refresh() {
        if (!this.enabled) {
            return
        }

        this.removeBlips()
        this.stopMarkerTick()

        this.zones = this.calculateZones()

        this.createBlips()
        this.startMarkerTick()
    }

    /**
     * Resolve the configured zones into radii, using the signal calculation of the radio.
     *
     * @returns {YacaTowerCoverageZone[]} The zones, sorted ascending by radius.
     */
    calculateZones(): YacaTowerCoverageZone[] {
        return this.config.zones
            .map((zone) => ({
                radius: this.radioModule.calculateDistanceForSignalStrength(zone.signalStrength),
                blipColor: zone.blipColor,
                blipAlpha: zone.blipAlpha,
                r: zone.r,
                g: zone.g,
                b: zone.b,
            }))
            .sort((firstZone, secondZone) => firstZone.radius - secondZone.radius)
    }

    /**
     * Get the zone a distance to a tower falls into.
     *
     * @param distance - The distance to the tower.
     *
     * @returns {YacaTowerCoverageZone | undefined} The zone, or `undefined` if the tower does not reach that far.
     */
    getZoneForDistance(distance: number): YacaTowerCoverageZone | undefined {
        return this.zones.find((zone) => distance <= zone.radius)
    }

    /**
     * Create the blips for the towers and the area they cover.
     */
    createBlips() {
        if (!this.config.blip.enabled && !this.config.blip.showZones) {
            return
        }

        if (!this.radioModule.clientModule.isFiveM) {
            console.warn('[YaCA] The tower visualization blips are only available in FiveM.')
            return
        }

        if (this.config.blip.showZones) {
            /*
             * The zones are drawn from the outside in and across all towers at once, so a good signal of one tower
             * always stays visible on top of the weak signal of the towers around it.
             */
            for (const zone of [...this.zones].reverse()) {
                for (const [x, y, z] of this.towerPositions) {
                    const zoneBlip = AddBlipForRadius(x, y, z, zone.radius)

                    SetBlipColour(zoneBlip, zone.blipColor)
                    SetBlipAlpha(zoneBlip, zone.blipAlpha)

                    this.blips.push(zoneBlip)
                }
            }
        }

        if (this.config.blip.enabled) {
            for (const [x, y, z] of this.towerPositions) {
                const towerBlip = AddBlipForCoord(x, y, z)

                SetBlipSprite(towerBlip, this.config.blip.sprite)
                SetBlipColour(towerBlip, this.config.blip.color)
                SetBlipScale(towerBlip, this.config.blip.scale)
                SetBlipAsShortRange(towerBlip, true)

                BeginTextCommandSetBlipName('STRING')
                AddTextComponentSubstringPlayerName(locale('radio_tower'))
                EndTextCommandSetBlipName(towerBlip)

                this.blips.push(towerBlip)
            }
        }
    }

    /**
     * Remove all blips of the visualization.
     */
    removeBlips() {
        for (const blip of this.blips) {
            RemoveBlip(blip)
        }

        this.blips = []
    }

    /**
     * Start drawing a marker at every tower in range, coloured by the zone the player is in for that tower.
     */
    startMarkerTick() {
        if (!this.config.marker.enabled || this.markerTick) {
            return
        }

        if (!this.radioModule.clientModule.isFiveM && this.config.marker.type < 1000) {
            this.config.marker.type = 0x94fdae17
            console.warn('[YaCA] Marker type is not supported in RedM. Using default marker type.')
        }

        this.markerTick = setInterval(() => {
            const playerPosition = GetEntityCoords(cache.ped, false)

            for (const tower of this.towerPositions) {
                const distance = calculateDistanceVec3(playerPosition, tower)
                if (distance > this.config.marker.drawDistance) {
                    continue
                }

                /*
                 * Towers beyond the outermost zone keep its color as long as they are still in range, as the zones
                 * only describe the good part of the signal, not the distance at which the radio stops working.
                 */
                const zone = this.getZoneForDistance(distance) ?? this.zones[this.zones.length - 1]
                if (!zone || distance > this.radioModule.clientModule.sharedConfig.radioSettings.maxDistance) {
                    continue
                }

                DrawMarker(
                    this.config.marker.type,
                    tower[0],
                    tower[1],
                    tower[2],
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    this.config.marker.scale,
                    this.config.marker.scale,
                    this.config.marker.height,
                    zone.r,
                    zone.g,
                    zone.b,
                    this.config.marker.alpha,
                    false,
                    false,
                    2,
                    false,
                    // @ts-expect-error Type error in the native
                    null,
                    null,
                    false,
                )
            }
        })
    }

    /**
     * Stop drawing the markers.
     */
    stopMarkerTick() {
        if (!this.markerTick) {
            return
        }

        clearInterval(this.markerTick)
        this.markerTick = null
    }
}
