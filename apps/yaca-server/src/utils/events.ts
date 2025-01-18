export const triggerClientEvent = (eventName: string, targetIds: number[] | number, ...args: unknown[]) => {
  if (!Array.isArray(targetIds)) {
    targetIds = [targetIds]
  }

  if (targetIds.length < 1) {
    return
  }

  // @ts-expect-error - msgpack_pack is not typed but available in the global scope.
  const dataSerialized = msgpack_pack(args)

  for (const targetId of targetIds) {
    TriggerClientEventInternal(eventName, targetId.toString(), dataSerialized, dataSerialized.length)
  }
}
