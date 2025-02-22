export * from './bridge'
export * from './config'
export * from './constants'
export * from './errorlevel'
export * from './locale'

/**
 * Sleeps for a given amount of time.
 *
 * @param ms - The amount of time to sleep in milliseconds.
 */
export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms, null))
}

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
 * Creates a promise that will be resolved once any value is returned by the function (including null).
 * @param cb Function to call.
 * @param errMessage Error message to throw if the function never resolves.
 * @param {number?} timeout Error out after `~x` ms. Defaults to 1000, unless set to `false`.
 */
export async function waitFor<T>(cb: () => T, errMessage?: string, timeout?: number | false): Promise<T> {
    let value = await cb()

    if (value !== undefined) return value

    if (timeout || timeout == null) {
        if (typeof timeout !== 'number') timeout = 1000
    }

    const start = GetGameTimer()
    let id: number

    return new Promise<T>((resolve, reject) => {
        id = setTick(async () => {
            const elapsed = timeout && GetGameTimer() - start

            if (elapsed && elapsed > (timeout as number)) {
                return reject(`${errMessage || 'failed to resolve callback'} (waited ${elapsed}ms)`)
            }

            value = await cb()

            if (value !== undefined) resolve(value)
        })
    }).finally(() => clearTick(id))
}
