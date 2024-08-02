/**
 * Load a config file from the resource and merge it with the default values.
 *
 * @param filePath - The path to the config file.
 * @param defaultValues - The default values to set when the config file is missing values.
 *
 * @returns The loaded config.
 */
export function loadConfig<T extends object>(filePath: string, defaultValues: T): T {
  const fileData = LoadResourceFile(GetCurrentResourceName(), filePath);

  if (!fileData) {
    return defaultValues;
  }

  const parsedData = JSON.parse(fileData) as T;

  for (const key in defaultValues) {
    if (!(key in parsedData)) {
      console.warn(
        `[YaCA] Missing config value for key '${key}' setting to default value: ${defaultValues[key]}\nMissing config values can cause unexpected behavior of the script.`,
      );
    }
  }

  for (const key in parsedData) {
    if (!(key in defaultValues)) {
      console.warn(`[YaCA] Unknown config key '${key}' found in config file. This keys will be ignored and can be removed.`);
    }
  }

  return { ...defaultValues, ...parsedData };
}
