import { ClientCache } from "types";

const playerId = PlayerId();

/**
 * Cached values for the client.
 */
const cache: ClientCache = new Proxy(
  {
    serverId: GetPlayerServerId(playerId),
    playerId,
    resource: GetCurrentResourceName(),
    ped: PlayerPedId(),
    vehicle: false,
    seat: false,
  },
  {
    set(target: ClientCache, key: keyof ClientCache, value: never) {
      target[key] = value;
      emit(`yaca:cache:${key}`, value);
      return true;
    },
    get(target: ClientCache, key: keyof ClientCache) {
      const result = key ? target[key] : target;
      if (result !== undefined) return result;

      return target[key];
    },
  },
);

/**
 * Initializes the cache and starts updating it.
 */
function initCache() {
  /**
   * This function will update the cache every 100ms.
   */
  const updateCache = () => {
    const ped = PlayerPedId();
    cache.ped = ped;

    const vehicle = GetVehiclePedIsIn(ped, false);

    if (vehicle > 0) {
      cache.vehicle = vehicle;

      if (cache.seat || GetPedInVehicleSeat(vehicle, -1) !== ped) {
        for (
          let i = -1;
          i < GetVehicleMaxNumberOfPassengers(vehicle) - 1;
          i++
        ) {
          if (GetPedInVehicleSeat(vehicle, i) === ped) {
            cache.seat = i;
            break;
          }
        }
      }
    } else {
      cache.vehicle = false;
      cache.seat = false;
    }

    setTimeout(updateCache, 100);
  };

  updateCache();
}

/**
 * Listen for cache updates.
 *
 * @param key - The cache key to listen for.
 * @param cb - The callback to execute when the cache updates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onCache = <T = any>(
  key: keyof ClientCache,
  cb: (value: T) => void,
) => {
  on(`yaca:cache:${key}`, cb);
};

export { initCache, cache };
