import { printf } from 'fast-printf';

const resourceName = GetCurrentResourceName();
const dict: Record<string, string> = {};

/**
 * Flattens a dictionary.
 *
 * @param source - The source dictionary to flatten.
 * @param target - The target dictionary to flatten to.
 * @param prefix - The prefix to use.
 */
function flattenDict(source: Record<string, string | number | boolean>, target: Record<string, string>, prefix?: string) {
    for (const [key, value] of Object.entries(source)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object') flattenDict(value, target, fullKey);
        else target[fullKey] = String(value);
    }

    return target;
}

/**
 * Get the localized string for a key.
 *
 * @param str - The key to get the localized string for.
 * @param args - The arguments to use for string interpolation.
 */
export const locale = (str: string, ...args: (string | number | boolean)[]): string => {
    const localeStr = dict[str];

    if (localeStr) {
        if (args.length > 0) {
            return printf(localeStr, ...args);
        }

        return localeStr;
    } else {
        return str;
    }
};

/**
 * Get all the locales.
 */
export const getLocales = () => dict;

/**
 * Initialize the locale.
 *
 * @param configLocale - The locale to use. Defaults to 'en'. If not found, falls back to 'en'.
 */
export const initLocale = (configLocale: string) => {
    const lang = configLocale || 'en'
    let locales: typeof dict = JSON.parse(LoadResourceFile(resourceName, `locales/${lang}.json`));

    if (!locales) {
        console.warn(`could not load 'locales/${lang}.json'`);

        if (lang !== 'en') {
            locales = JSON.parse(LoadResourceFile(resourceName, 'locales/en.json'));

            if (!locales) {
                console.warn("could not load 'locales/en.json'");
            }
        }

        if (!locales) return;
    }

    const flattened = flattenDict(locales, {});

    for (let [k, v] of Object.entries(flattened)) {
        const regExp = new RegExp(/\$\{([^}]+)}/g);
        const matches = v.match(regExp);
        if (matches) {
            for (const match of matches) {
                if (!match) break;
                const variable = match.substring(2, match.length - 1) as keyof typeof locales;
                const locale: string = flattened[variable];

                if (locale) {
                    v = v.replace(match, locale);
                }
            }
        }

        dict[k] = v;
    }
};