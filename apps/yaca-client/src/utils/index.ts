import { cache } from './cache'

export * from './vectors'
export * from './websocket'
export * from './cache'
export * from './streaming'
export * from './vehicle'
export * from './redm'

/**
 * Clamps a value between a minimum and maximum value.
 *
 * @param {number} value - The value to be clamped.
 * @param {number} [min=0] - The minimum value. Defaults to 0 if not provided.
 * @param {number} [max=1] - The maximum value. Defaults to 1 if not provided.
 */
export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Rounds a float to a specified number of decimal places.
 * Defaults to 2 decimal places if not provided.
 *
 * @param {number} num - The number to round.
 * @param {number} decimalPlaces - The number of decimal places to round to.
 *
 * @returns {number} The rounded number.
 */
export function roundFloat(num: number, decimalPlaces = 17): number {
  return Number.parseFloat(num.toFixed(decimalPlaces))
}

/**
 * Convert camera rotation to direction vector.
 *
 * @returns {x: number, y: number, z: number} The direction vector.
 */
export function getCamDirection(): { x: number; y: number; z: number } {
  const rotVector = GetGameplayCamRot(0)
  const num = rotVector[2] * 0.0174532924
  const num2 = rotVector[0] * 0.0174532924
  const num3 = Math.abs(Math.cos(num2))

  return {
    x: roundFloat(-Math.sin(num) * num3),
    y: roundFloat(Math.cos(num) * num3),
    z: roundFloat(GetEntityForwardVector(cache.ped)[2]),
  }
}
