import { ClientCache } from "types";

const playerId = PlayerId();

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

function initCache() {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onCache = <T = any>(
  key: keyof ClientCache,
  cb: (value: T) => void,
) => {
  on(`yaca:cache:${key}`, cb);
};

export { initCache, cache };
