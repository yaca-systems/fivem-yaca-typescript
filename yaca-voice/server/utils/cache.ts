import { ServerCache } from "types";

/**
 * Cached values for the server.
 */
export const cache: ServerCache = {
  resource: GetCurrentResourceName(),
};
