import { cache } from "./cache";

export * from "./vectors";
export * from "./websocket";
export * from "./cache";
export * from "./streaming";
export * from "./vehicle";

/**
 * Clamps a value between a minimum and maximum value.
 *
 * @param {number} value - The value to be clamped.
 * @param {number} [min=0] - The minimum value. Defaults to 0 if not provided.
 * @param {number} [max=1] - The maximum value. Defaults to 1 if not provided.
 */
export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert camera rotation to direction vector.
 */
export function getCamDirection(): { x: number; y: number; z: number } {
  const rotVector = GetGameplayCamRot(0),
    num = rotVector[2] * 0.0174532924,
    num2 = rotVector[0] * 0.0174532924,
    num3 = Math.abs(Math.cos(num2));

  return {
    x: -Math.sin(num) * num3,
    y: Math.cos(num) * num3,
    z: GetEntityForwardVector(cache.ped)[2],
  };
}
