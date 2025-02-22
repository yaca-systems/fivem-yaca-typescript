import { waitFor } from '@yaca-voice/common'
import { joaat } from './props'

/**
 * Request an asset and wait for it to load.
 *
 * @param request - The function to request the asset
 * @param hasLoaded - The function to check if the asset has loaded
 * @param assetType - The type of the asset
 * @param asset - The asset to request
 * @param timeout - The timeout in ms
 */
async function streamingRequest<T extends string | number>(
    request: (asset: T) => unknown,
    hasLoaded: (asset: T) => boolean,
    assetType: string,
    asset: T,
    timeout = 30000,
) {
    if (hasLoaded(asset)) return asset

    request(asset)

    return waitFor(
        () => {
            if (hasLoaded(asset)) return asset
        },
        `failed to load ${assetType} '${asset}' - this may be caused by\n- too many loaded assets\n- oversized, invalid, or corrupted assets`,
        timeout,
    )
}

/**
 * Request a animation dictionary.
 *
 * @param animDict - The animation dictionary to request.
 * @returns A promise that resolves to the animation dictionary once it is loaded.
 * @throws Will throw an error if the animation dictionary is not valid or if the animation dictionary fails to load within the timeout.
 */
export const requestAnimDict = (animDict: string) => {
    if (!DoesAnimDictExist(animDict)) throw new Error(`attempted to load invalid animDict '${animDict}'`)

    return streamingRequest(RequestAnimDict, HasAnimDictLoaded, 'animDict', animDict)
}

/**
 * Loads a model by its name or hash key.
 *
 * @param modelName - The name or hash key of the model to load.
 * @returns A promise that resolves to the model hash key once the model is loaded.
 * @throws Will throw an error if the model is not valid or if the model fails to load within the timeout.
 */
export const requestModel = (modelName: string | number) => {
    if (typeof modelName !== 'number') modelName = joaat(modelName)
    if (!IsModelValid(modelName)) throw new Error(`attempted to load invalid model '${modelName}'`)

    return streamingRequest(RequestModel, HasModelLoaded, 'model', modelName)
}
