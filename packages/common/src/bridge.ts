// biome-ignore lint: no type for this callback
export function saltyChatExport(method: string, cb: (...args: any[]) => void) {
    on(
        `__cfx_export_saltychat_${method}`,
        // biome-ignore lint: no type for this callback
        (setCb: (...args: any[]) => void) => {
            setCb(cb)
        },
    )
}
