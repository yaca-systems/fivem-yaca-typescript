import { waitFor } from '@yaca-voice/common'

/**
 * Request a animation dictionary.
 *
 * @param animDict - The animation dictionary to request.
 * @param timeout - The timeout for the request.
 */
export const requestAnimDict = async (animDict: string, timeout?: number): Promise<string> => {
    if (!DoesAnimDictExist(animDict)) throw new Error(`attempted to load invalid animDict '${animDict}' (does not exist)`)
    if (HasAnimDictLoaded(animDict)) return animDict

    RequestAnimDict(animDict)

    await waitFor(
        () => {
            if (HasAnimDictLoaded(animDict)) return animDict
            return null
        },
        `failed to load animDict '${animDict}' after ${timeout} ticks`,
        timeout || 5000,
    )

    return animDict
}
