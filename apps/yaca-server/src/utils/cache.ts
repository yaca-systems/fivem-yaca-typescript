import type { ServerCache } from '@yaca-voice/types'

/**
 * Cached values for the server.
 */
export const cache: ServerCache = {
    resource: GetCurrentResourceName(),
}
