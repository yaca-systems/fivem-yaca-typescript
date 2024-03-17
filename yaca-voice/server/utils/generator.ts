/**
 * Generate a random integer between min and max.
 * If min is greater than max, the values are swapped.
 * If no values are provided, the default range is 0-9.
 *
 * @param min - The minimum value.
 * @param max - The maximum value.
 */
export function getRandomInt(min = 0, max = 9) {
  if (min > max) [min, max] = [max, min];

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random character.
 * If lowercase is true, the character is returned in lowercase.
 * If no value is provided, the default is an uppercase character.
 *
 * @param lowercase - Whether to return a lowercase character.
 */
export function getRandomChar(lowercase?: boolean) {
  const str = String.fromCharCode(getRandomInt(65, 90));
  return lowercase ? str.toLowerCase() : str;
}

/**
 * Generate a random alphanumeric character.
 * If lowercase is true, the character is returned in lowercase.
 * If no value is provided, the default is an uppercase alphanumeric character.
 *
 * @param lowercase - Whether to return a lowercase character.
 */
export function getRandomAlphanumeric(lowercase?: boolean) {
  return Math.random() > 0.5 ? getRandomChar(lowercase) : getRandomInt();
}

/**
 * Generate a random string based on a pattern.
 *
 * @param pattern
 *  - The pattern to use for the string.
 *  - A = Uppercase letter.
 *  - a = Lowercase letter.
 *  - 1 = Number.
 *  - . = Alphanumeric.
 * @param length - The length of the string. Defaults to the length of the pattern.
 */
export function getRandomString(pattern: string, length?: number): string {
  const len = length || pattern.replace(/\^/g, "").length;
  const arr: Array<string | number> = Array(len).fill(0);
  let size = 0;
  let i = 0;

  while (size < len) {
    i += 1;
    let char: string | number = pattern.charAt(i - 1);

    if (char === "") {
      arr[size] = " ".repeat(len - size);
      break;
    } else if (char === "^") {
      i += 1;
      char = pattern.charAt(i - 1);
    } else {
      if (char === "1") {
        char = getRandomInt();
      } else if (char === "A") {
        char = getRandomChar();
      } else if (char === ".") {
        char = getRandomAlphanumeric();
      } else if (char === "a") {
        char = getRandomChar(true);
      }
    }

    size += 1;
    arr[size - 1] = char;
  }

  return arr.join("");
}

/**
 * Generate a random name and insert it into the database.
 *
 * @param src The ID of the player.
 * @param nameSet The set of names to check against.
 */
export function generateRandomName(src: number, nameSet: Set<string>): string | undefined {
  let name: string | undefined;
  for (let i = 0; i < 10; i++) {
    let generatedName = `[${src}] - ${getRandomString("...............", 15)}`;
    generatedName = generatedName.slice(0, 30);
    if (!nameSet.has(generatedName)) {
      name = generatedName;
      nameSet.add(generatedName);
      break;
    }
  }

  if (!name) {
    console.error(`YaCA: Couldn't generate a random name for player ${GetPlayerName(src.toString())} (ID: ${src}).`);
  }

  return name;
}
