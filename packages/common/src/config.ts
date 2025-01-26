import JSON5 from 'json5'

function mergeAndValidate<T extends object>(defaultObj: T, parsedObj: T, path: string[] = []): T {
  const result: T = { ...defaultObj }

  for (const key in defaultObj) {
    const currentPath = [...path, key].join('.')

    if (!(key in parsedObj)) {
      console.warn(
        `[YaCA] Missing config value for key '${currentPath}' setting to default value: ${defaultObj[key]}\nMissing config values can cause unexpected behavior of the script.`,
      )
    } else if (
      typeof defaultObj[key] === 'object' &&
      defaultObj[key] !== null &&
      !Array.isArray(defaultObj[key]) &&
      typeof parsedObj[key] === 'object' &&
      parsedObj[key] !== null &&
      !Array.isArray(parsedObj[key])
    ) {
      // Recursive merge for nested objects
      result[key] = mergeAndValidate(defaultObj[key], parsedObj[key], [...path, key])
    } else {
      result[key] = parsedObj[key]
    }
  }

  for (const key in parsedObj) {
    const currentPath = [...path, key].join('.')

    if (!(key in defaultObj)) {
      console.warn(`[YaCA] Unknown config key '${currentPath}' found in config file. This key will be ignored and can be removed.`)
    }
  }

  return result
}

/**
 * Load a config file from the resource and merge it with the default values.
 *
 * @param filePath - The path to the config file.
 * @param defaultValues - The default values to set when the config file is missing values.
 *
 * @returns The loaded config.
 */
export function loadConfig<T extends object>(filePath: string, defaultValues: T): T {
  const fileData = LoadResourceFile(GetCurrentResourceName(), filePath)

  if (!fileData) {
    return defaultValues
  }

  const parsedData = JSON5.parse(fileData) as T

  return mergeAndValidate<T>(defaultValues, parsedData)
}
