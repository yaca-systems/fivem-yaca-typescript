import { roundFloat } from './index'

/**
 * Calculate the distance between two points in 3D space
 *
 * @param firstPoint - The first point
 * @param secondPoint - The second point
 */
export function calculateDistanceVec3(firstPoint: number[], secondPoint: number[]) {
    return Math.sqrt((firstPoint[0] - secondPoint[0]) ** 2 + (firstPoint[1] - secondPoint[1]) ** 2 + (firstPoint[2] - secondPoint[2]) ** 2)
}

/**
 * Calculate the distance between two points in 2D space
 *
 * @param firstPoint - The first point
 * @param secondPoint - The second point
 */
export function calculateDistanceVec2(firstPoint: number[], secondPoint: number[]) {
    return Math.sqrt((firstPoint[0] - secondPoint[0]) ** 2 + (firstPoint[1] - secondPoint[1]) ** 2)
}

/**
 * Convert an array of numbers to an object with x, y, and z properties
 *
 * @param array - The array to convert
 */
export function convertNumberArrayToXYZ(array: number[]): {
    x: number
    y: number
    z: number
} {
    return {
        x: roundFloat(array[0]),
        y: roundFloat(array[1]),
        z: roundFloat(array[2]),
    }
}
