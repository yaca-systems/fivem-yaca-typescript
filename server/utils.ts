import { YaCAServerModule } from "yaca.server";

/**
 * Generates a random string of a given length.
 *
 * @param {number} [length=50] - The length of the string to generate. Defaults to 50 if not provided.
 * @param {string} [possible="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"] - The characters to use in the string. Defaults to all alphanumeric characters if not provided.
 * @returns {string} The generated random string.
 */
function generateRandomString(
  length: number = 50,
  possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
): string {
  let text = "";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Generate a random name and insert it into the database.
 *
 * @param src The ID of the player.
 */
export function generateRandomName(src: string): string | undefined {
  let name: string | undefined;
  for (let i = 0; i < 10; i++) {
    const generatedName = generateRandomString(15);
    if (!YaCAServerModule.nameSet.has(generatedName)) {
      name = generatedName;
      YaCAServerModule.nameSet.add(generatedName);
      break;
    }
  }

  if (!name) {
    console.error(
      `YaCA: Couldn't generate a random name for player ${GetPlayerName(src)} (ID: ${src}).`,
    );
  }

  return name;
}
