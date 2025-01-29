/**
 * Send a event to one or multiple clients.
 *
 * @param eventName - The name of the event.
 * @param targetIds - The target ids.
 * @param args - The arguments to send.
 */
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
