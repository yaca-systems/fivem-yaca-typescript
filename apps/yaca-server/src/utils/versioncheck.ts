import fetch from 'node-fetch'
import { cache } from './cache'

/**
 * Checks the version of the resource against the latest release on GitHub.
 * If the resource is outdated, a message will be printed to the console.
 */
export const checkVersion = async () => {
    const currentVersion = GetResourceMetadata(cache.resource, 'version', 0)

    if (!currentVersion) {
        console.error('[YaCA] Version check failed, no version found in resource manifest.')
        return
    }

    const parsedVersion = currentVersion.match(/\d+\.\d+\.\d+/g)

    if (!parsedVersion) {
        console.error('[YaCA] Version check failed, version in resource manifest is not in the correct format.')
        return
    }

    const response = await fetch('https://api.github.com/repos/yaca-systems/fivem-yaca-typescript/releases/latest')
    if (response.status !== 200) {
        console.error('[YaCA] Version check failed, unable to fetch latest release.')
        return
    }

    const data = (await response.json()) as { tag_name: string; html_url: string }

    const latestVersion = data.tag_name
    if (!latestVersion && latestVersion === currentVersion) {
        console.log('[YaCA] You are running the latest version of YaCA.')
        return
    }

    const parsedLatestVersion = latestVersion.match(/\d+\.\d+\.\d+/g)
    if (!parsedLatestVersion) {
        console.error('[YaCA] Version check failed, latest release is not in the correct format.')
        return
    }

    for (let i = 0; i < parsedVersion.length; i++) {
        const current = Number.parseInt(parsedVersion[i])
        const latest = Number.parseInt(parsedLatestVersion[i])

        if (current !== latest) {
            if (current < latest) {
                console.error(
                    `[YaCA] You are running an outdated version of YaCA. (current: ${currentVersion}, latest: ${latestVersion}) \r\n ${data.html_url}`,
                )
            } else {
                break
            }
        }
    }
}
