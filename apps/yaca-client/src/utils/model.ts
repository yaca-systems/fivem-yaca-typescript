import { waitFor } from '@yaca-voice/common'

/**
 * Loads a model by its name or hash key.
 *
 * @param modelName - The name or hash key of the model to load.
 * @returns A promise that resolves to the model hash key once the model is loaded.
 * @throws Will throw an error if the model is not valid or if the model fails to load within the timeout.
 */
export async function loadModel(modelName: string | number) {
    let model = modelName
    if (typeof modelName === 'string') {
        model = GetHashKey(modelName)
    }

    if (!IsModelValid(model)) throw new Error(`Model ${modelName} is not valid`)

    try {
        RequestModel(model)
        await waitFor(() => HasModelLoaded(model), 'Failed to load model within timeout', 5000)

        return model
    } catch (e) {
        throw new Error(`Failed to request Model: ${model}: ${e}`)
    }
}
