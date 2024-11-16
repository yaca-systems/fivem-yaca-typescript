export function saltyChatExport(method: string, cb: (...args: never[]) => void) {
  on(`__cfx_export_saltychat_${method}`, (setCb: (...args: unknown[]) => void) => {
    setCb(cb)
  })
}
