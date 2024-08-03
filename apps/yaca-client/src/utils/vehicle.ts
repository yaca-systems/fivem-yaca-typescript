/**
 * Checks if the vehicle has a window.
 *
 * @param vehicle - The vehicle.
 * @param windowId - The window ID to check.
 * @returns {boolean} - Whether the vehicle has a window.
 */
export function hasWindow(vehicle: number, windowId: number): boolean {
  switch (windowId) {
    case 0:
      return GetEntityBoneIndexByName(vehicle, "window_lf") !== -1;
    case 1:
      return GetEntityBoneIndexByName(vehicle, "window_rf") !== -1;
    case 2:
      return GetEntityBoneIndexByName(vehicle, "window_lr") !== -1;
    case 3:
      return GetEntityBoneIndexByName(vehicle, "window_rr") !== -1;
    default:
      return false;
  }
}

/**
 * Checks if the vehicle has a door.
 *
 * @param vehicle - The vehicle.
 * @param doorId - The door ID to check.
 * @returns {boolean} - Whether the vehicle has a door.
 */
export function hasDoor(vehicle: number, doorId: number): boolean {
  switch (doorId) {
    case 0:
      return GetEntityBoneIndexByName(vehicle, "door_dside_f") !== -1;
    case 1:
      return GetEntityBoneIndexByName(vehicle, "door_pside_f") !== -1;
    case 2:
      return GetEntityBoneIndexByName(vehicle, "door_dside_r") !== -1;
    case 3:
      return GetEntityBoneIndexByName(vehicle, "door_pside_r") !== -1;
    case 4:
      return GetEntityBoneIndexByName(vehicle, "bonnet") !== -1;
    case 5:
      return GetEntityBoneIndexByName(vehicle, "boot") !== -1;
    default:
      return false;
  }
}

/**
 * Checks if the vehicle has an opening.
 *
 * @param vehicle - The vehicle.
 * @returns {boolean} - Whether the vehicle has an opening.
 */
export function vehicleHasOpening(vehicle: number): boolean {
  const doors = [];
  for (let i = 0; i < 6; i++) {
    if (i === 4 || !hasDoor(vehicle, i)) continue;
    doors.push(i);
  }

  if (doors.length === 0) return true;
  for (const door of doors) {
    const doorAngle = GetVehicleDoorAngleRatio(vehicle, door);
    if (doorAngle > 0) {
      return true;
    }

    if (IsVehicleDoorDamaged(vehicle, door)) {
      return true;
    }
  }

  if (!AreAllVehicleWindowsIntact(vehicle)) {
    return true;
  }

  for (let i = 0; i < 8 /* max windows */; i++) {
    const hasWindows = hasWindow(vehicle, i);
    if (hasWindows && !IsVehicleWindowIntact(vehicle, i)) {
      return true;
    }
  }

  if (IsVehicleAConvertible(vehicle, false)) {
    const roofState = GetConvertibleRoofState(vehicle);
    if (roofState !== 0) {
      return true;
    }
  }

  return false;
}
