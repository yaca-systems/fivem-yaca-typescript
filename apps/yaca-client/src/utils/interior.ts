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
