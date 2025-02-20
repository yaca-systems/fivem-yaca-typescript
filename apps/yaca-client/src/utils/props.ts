import { cache } from './cache'
import { requestModel } from './streaming'

/**
 * Create a prop and attach it to the player.
 *
 * @param model - The model of the prop.
 * @param boneId - The bone id to attach the prop to.
 * @param offset - The offset of the prop.
 * @param rotation - The rotation of the prop.
 */
export const createProp = async (
    model: string | number,
    boneId: number,
    offset: [number, number, number] = [0.0, 0.0, 0.0],
    rotation: [number, number, number] = [0.0, 0.0, 0.0],
) => {
    const modelHash = await requestModel(model)
    if (!modelHash) return

    const [x, y, z] = GetEntityCoords(cache.ped, true)
    const [ox, oy, oz] = offset
    const [rx, ry, rz] = rotation
    const object = CreateObject(modelHash, x, y, z, true, true, false)
    SetEntityCollision(object, false, false)
    AttachEntityToEntity(object, cache.ped, GetPedBoneIndex(cache.ped, boneId), ox, oy, oz, rx, ry, rz, true, false, false, true, 2, true)

    return object
}
