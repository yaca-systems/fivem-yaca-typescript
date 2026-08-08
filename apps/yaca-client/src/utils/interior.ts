import { joaat } from './props'

export interface InteriorRoomPair {
    interiorKey: number
    roomKey: number
}

export const OUTSIDE_ROOM_PAIR: InteriorRoomPair = { interiorKey: 0, roomKey: 0 }

/**
 * Converts the signed int32 a GTA native returns into the uint32 the plugin expects, e.g. -1711658181 to 2583309115.
 *
 * @param value - The signed value returned by the native.
 * @returns {number} The uint32 representation of the value.
 */
export function toUInt32(value: number): number {
    return value >>> 0
}

/**
 * Get the (interior, room) pair of an entity as uint32 keys.
 *
 * @param entity - The entity to get the pair for.
 * @returns {InteriorRoomPair} The pair, or `OUTSIDE_ROOM_PAIR` if the entity is not inside a resolvable room.
 */
export function getInteriorRoomPair(entity: number): InteriorRoomPair {
    const interior = GetInteriorFromEntity(entity)
    if (!interior) {
        return OUTSIDE_ROOM_PAIR
    }

    const [, interiorNameHash] = GetInteriorLocationAndNamehash(interior)

    const interiorKey = toUInt32(interiorNameHash)
    const roomKey = toUInt32(GetRoomKeyFromEntity(entity))

    if (!interiorKey || !roomKey) {
        return OUTSIDE_ROOM_PAIR
    }

    return { interiorKey, roomKey }
}

/**
 * Get the (interior, room) pair of a world position as uint32 keys.
 *
 * Unlike {@link getInteriorRoomPair} this needs no entity standing there, which is what makes it usable for fixed
 * loudspeakers: their room is the room they hang in, no matter where anybody stands.
 *
 * @param position - The world position to get the pair for.
 * @returns {InteriorRoomPair} The pair, or `OUTSIDE_ROOM_PAIR` if the position is not inside a resolvable room.
 */
export function getInteriorRoomPairAtCoords(position: { x: number; y: number; z: number }): InteriorRoomPair {
    const interior = GetInteriorAtCoords(position.x, position.y, position.z)
    if (!interior || !IsValidInterior(interior)) {
        return OUTSIDE_ROOM_PAIR
    }

    const [, interiorNameHash] = GetInteriorLocationAndNamehash(interior)
    const interiorKey = toUInt32(interiorNameHash)
    if (!interiorKey) {
        return OUTSIDE_ROOM_PAIR
    }

    let roomKey = 0
    let smallestVolume = Number.POSITIVE_INFINITY

    const roomCount = GetInteriorRoomCount(interior)
    for (let roomIndex = 0; roomIndex < roomCount; roomIndex++) {
        const [minX, minY, minZ, maxX, maxY, maxZ] = GetInteriorRoomExtents(interior, roomIndex)

        if (position.x < minX || position.x > maxX) continue
        if (position.y < minY || position.y > maxY) continue
        if (position.z < minZ || position.z > maxZ) continue

        const volume = (maxX - minX) * (maxY - minY) * (maxZ - minZ)
        if (volume >= smallestVolume) {
            continue
        }

        const roomName = GetInteriorRoomName(interior, roomIndex)
        if (!roomName) {
            continue
        }

        roomKey = joaat(roomName, false)
        smallestVolume = volume
    }

    if (!roomKey) {
        return OUTSIDE_ROOM_PAIR
    }

    return { interiorKey, roomKey }
}
