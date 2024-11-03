import { GLOBAL_ERROR_LEVEL_STATE_NAME } from './constants'
import { clamp } from './index'

/**
 * Set the global error level.
 *
 * @param errorLevel The new error level. Between 0 and 1.
 */
export const setGlobalErrorLevel = (errorLevel: number) => {
    GlobalState.set(GLOBAL_ERROR_LEVEL_STATE_NAME, clamp(errorLevel, 0, 1), true)
}

/**
 * Get the global error level.
 *
 * @returns The global error level.
 */
export const getGlobalErrorLevel = () => {
    return GlobalState[GLOBAL_ERROR_LEVEL_STATE_NAME] ?? 0
}
