/**
 * Add an export in the saltychat namespace.
 *
 * @param method - the export method name
 * @param cb - the callback to execute
 */
export function saltyChatExport(method: string, cb: (...args: never[]) => void) {
    on(`__cfx_export_saltychat_${method}`, (setCb: (...args: unknown[]) => void) => {
        setCb(cb)
    })
}
