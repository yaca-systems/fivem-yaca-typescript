import { getRandomString } from "@overextended/ox_lib/server";

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
