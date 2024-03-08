import { printf } from 'fast-printf';

const resourceName = GetCurrentResourceName();
const dict: Record<string, string> = {};

function flattenDict(source: Record<string, any>, target: Record<string, string>, prefix?: string) {
    for (const key in source) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = source[key];

        if (typeof value === 'object') flattenDict(value, target, fullKey);
        else target[fullKey] = String(value);
    }

    return target;
}

export const locale = (str: string, ...args: any[]): string => {
    const lstr = dict[str];

    if (lstr) {
        if (args.length > 0) {
            return printf(lstr, ...args);
        }

        return lstr;
    } else {
        return str;
    }
};

export const getLocales = () => dict;

export const initLocale = (configLocale: string) => {
    const lang = configLocale || 'en'
    let locales: typeof dict = JSON.parse(LoadResourceFile(resourceName, `locales/${lang}.json`));

    if (!locales) {
        console.warn(`could not load 'locales/${lang}.json'`);

        if (lang !== 'en') {
            locales = JSON.parse(LoadResourceFile(resourceName, 'locales/en.json'));

            if (!locales) {
                console.warn(`could not load 'locales/en.json'`);
            }
        }

        if (!locales) return;
    }

    const flattened = flattenDict(locales, {});

    for (let [k, v] of Object.entries(flattened)) {
        const regExp = new RegExp(/\$\{([^}]+)\}/g);
        const matches = v.match(regExp);
        if (matches) {
            for (const match of matches) {
                if (!match) break;
                const variable = match.substring(2, match.length - 1) as keyof typeof locales;
                let locale: string = flattened[variable];

                if (locale) {
                    v = v.replace(match, locale);
                }
            }
        }

        dict[k] = v;
    }
};