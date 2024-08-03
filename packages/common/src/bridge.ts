// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saltyChatExport(method: string, cb: (...args: any[]) => void) {
  on(
    `__cfx_export_saltychat_${method}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (setCb: (...args: any[]) => void) => {
      setCb(cb);
    },
  );
}
