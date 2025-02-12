import { loadModel } from 'src/utils/model.js'
import type { YaCAClientModule } from './main'

/**
 * The prop module for the client.
 */
export class YaCAClientPropModule {
    clientModule: YaCAClientModule
    propMap: Map<string, number> = new Map()

    /**
     * Creates an instance of the Prop module.
     *
     * @param clientModule - The client module.
     */
    constructor(clientModule: YaCAClientModule) {
        this.clientModule = clientModule
    }

    /**
     * Handles the creation, attachment, and deletion of a prop entity in the game.
     *
     * @param model - The model of the prop to handle. Can be a string or a number.
     * @param bondeId - The bone ID to which the prop will be attached.
     * @param offset - The offset position [x, y, z] for the prop relative to the bone. Defaults to [0.0, 0.0, 0.0].
     * @param rotation - The rotation [x, y, z] for the prop relative to the bone. Defaults to [0.0, 0.0, 0.0].
     *
     * @returns A promise that resolves when the prop has been handled.
     */
    async handleProp(
        model: string | number,
        bondeId: number,
        offset: [number, number, number] = [0.0, 0.0, 0.0],
        rotation: [number, number, number] = [0.0, 0.0, 0.0],
    ) {
        const modelhash = await loadModel(model)

        const propEntity = this.propMap.get(modelhash as string)
        if (propEntity) {
            if (DoesEntityExist(propEntity)) DeleteEntity(propEntity)
            this.propMap.delete(modelhash as string)
            return
        }

        const ped = GetPlayerPed(PlayerId())
        if (ped === 0) return

        const [x, y, z] = GetEntityCoords(ped, true)
        const [ox, oy, oz] = offset
        const [rx, ry, rz] = rotation
        const object = CreateObject(modelhash, x, y, z, true, true, false)
        SetEntityCollision(object, false, false)

        this.propMap.set(modelhash as string, object)

        AttachEntityToEntity(object, ped, GetPedBoneIndex(ped, bondeId), ox, oy, oz, rx, ry, rz, true, false, false, true, 2, true)
    }
}
