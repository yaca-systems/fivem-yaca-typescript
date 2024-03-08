export function getRandomInt(min = 0, max = 9) {
  if (min > max) [min, max] = [max, min];

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomChar(lowercase?: boolean) {
  const str = String.fromCharCode(getRandomInt(65, 90));
  return lowercase ? str.toLowerCase() : str;
}

export function getRandomAlphanumeric(lowercase?: boolean) {
  return Math.random() > 0.5 ? getRandomChar(lowercase) : getRandomInt();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatChar: Record<string, (...args: any) => string | number> = {
  "1": getRandomInt,
  A: getRandomChar,
  ".": getRandomAlphanumeric,
  a: getRandomChar,
};

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
      const fn = formatChar[char];
      char = fn ? fn(char === "a") : char;
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
export function generateRandomName(
  src: number,
  nameSet: Set<string>,
): string | undefined {
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
    console.error(
      `YaCA: Couldn't generate a random name for player ${GetPlayerName(src.toString())} (ID: ${src}).`,
    );
  }

  return name;
}
