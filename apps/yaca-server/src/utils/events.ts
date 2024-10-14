export const triggerClientEvent = (eventName: string, targetIds: number[] | number, ...args: unknown[]) => {
  // @ts-expect-error - This is a valid use case for the `source` variable
  const dataSerialized = msgpack_pack(args);

  if (Array.isArray(targetIds)) {
    for (const targetId of targetIds) {
      TriggerClientEventInternal(eventName, targetId.toString(), dataSerialized, dataSerialized.length);
    }

    return;
  }

  TriggerClientEventInternal(eventName, targetIds.toString(), dataSerialized, dataSerialized.length);
};
