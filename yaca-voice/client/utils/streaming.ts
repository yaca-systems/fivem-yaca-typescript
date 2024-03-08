import { waitFor } from "common/index";

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

export const requestAnimDict = (
  animDict: string,
  timeout?: number,
): Promise<string> => {
  if (!DoesAnimDictExist(animDict))
    throw new Error(`attempted to load invalid animDict '${animDict}'`);

  return streamingRequest(
    RequestAnimDict,
    HasAnimDictLoaded,
    "animDict",
    animDict,
    timeout,
  );
};
