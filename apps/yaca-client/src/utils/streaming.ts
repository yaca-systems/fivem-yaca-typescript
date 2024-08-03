import { waitFor } from "@yaca-voice/common";

/**
 * Requests an animation dictionary.
 *
 * @param request - The function to request the animation dictionary.
 * @param hasLoaded - The function to check if the animation dictionary has loaded.
 * @param assetType - The type of asset being requested.
 * @param asset - The asset being requested.
 * @param timeout - The timeout for the request.
 * @param args - The arguments for the request.
 */
async function streamingRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: (...args: any) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasLoaded: (...args: any) => boolean,
  assetType: string,
  asset: string,
  timeout?: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any
): Promise<string> {
  if (hasLoaded(asset)) return asset;

  request(asset, ...args);

  await waitFor(
    () => {
      if (hasLoaded(asset)) return asset;
      return null;
    },
    `failed to load ${assetType} '${asset}' after ${timeout} ticks`,
    timeout || 500,
  );

  return asset;
}

/**
 * Request a animation dictionary.
 *
 * @param animDict - The animation dictionary to request.
 * @param timeout - The timeout for the request.
 */
export const requestAnimDict = (animDict: string, timeout?: number): Promise<string> => {
  if (!DoesAnimDictExist(animDict)) throw new Error(`attempted to load invalid animDict '${animDict}'`);

  return streamingRequest(RequestAnimDict, HasAnimDictLoaded, "animDict", animDict, timeout);
};
