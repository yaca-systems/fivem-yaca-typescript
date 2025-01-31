import type { ClientCache } from '@yaca-voice/types'

const playerId = PlayerId()

/**
 * Cached values for the client.
 */
const cache: ClientCache = new Proxy(
    {
        playerId,
        serverId: GetPlayerServerId(playerId),
        ped: PlayerPedId(),
        vehicle: false,
        seat: false,
        resource: GetCurrentResourceName(),
        game: GetGameName() as 'fivem' | 'redm',
    },
    {
        set(target: ClientCache, key: keyof ClientCache, value: never) {
            if (target[key] === value) return true

            target[key] = value
            emit(`yaca:cache:${key}`, value)
            return true
        },
        get(target: ClientCache, key: keyof ClientCache) {
            return target[key]
        },
    },
)

/**
 * Initializes the cache and starts updating it.
 */
function initCache() {
    /**
     * This function will update the cache every 100ms.
     */
    const updateCache = () => {
        const ped = PlayerPedId()
        cache.ped = ped

        const vehicle = GetVehiclePedIsIn(ped, false)

        if (vehicle > 0) {
            cache.vehicle = vehicle

            if (!cache.seat || GetPedInVehicleSeat(vehicle, cache.seat) !== ped) {
                for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle) - 1; i++) {
                    if (GetPedInVehicleSeat(vehicle, i) === ped) {
                        cache.seat = i
                        break
                    }
                }
            }
        } else {
            cache.vehicle = false
            cache.seat = false
        }
    }

    setInterval(updateCache, 100)
}

/**
 * Listen for cache updates.
 *
 * @param key - The cache key to listen for.
 * @param cb - The callback to execute when the cache updates.
 */
export const onCache = <T = never>(key: keyof ClientCache, cb: (value: T) => void) => {
    on(`yaca:cache:${key}`, cb)
}

export { initCache, cache }
