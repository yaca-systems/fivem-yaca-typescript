export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms, null));
}

/**
 * Creates a promise that will be resolved once any value is returned by the function (including null).
 * @param cb Function to call.
 * @param errMessage Error message to throw if the function never resolves.
 * @param {number?} timeout Error out after `~x` ms. Defaults to 1000, unless set to `false`.
 */
export async function waitFor<T>(cb: () => T, errMessage?: string, timeout?: number | false): Promise<T> {
    let value = await cb();

    if (value !== undefined) return value;

    if (timeout || timeout == null) {
        if (typeof timeout !== 'number') timeout = 1000;

        if (IsDuplicityVersion()) timeout /= 50;
        else timeout -= GetFrameTime() * 1000;
    }

    const start = GetGameTimer();
    let id: number;
    let i = 0;

    const p = new Promise<T>((resolve, reject) => {
        id = setTick(async () => {
            if (timeout) {
                i++;

                if (i > timeout)
                    return reject(`${errMessage || 'failed to resolve callback'} (waited ${(GetGameTimer() - start) / 1000}ms)`);
            }

            value = await cb();

            if (value !== undefined) resolve(value);
        });
    }).finally(() => clearTick(id));

    return p;
}

export * from "types";