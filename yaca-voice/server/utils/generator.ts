import { randomUUID } from "node:crypto";

/**
 * Generate a random name and insert it into the database.
 *
 * @param src The ID of the player.
 * @param nameSet The set of names to check against.
 * @param namePattern The pattern to use for the name.
 */
export function generateRandomName(src: number, nameSet: Set<string>, namePattern: string): string | undefined {
  let name: string | undefined;

  const playerName = GetPlayerName(src.toString());

  for (let i = 0; i < 10; i++) {
    let generatedName = namePattern;
    generatedName = generatedName.replace("{serverid}", src.toString());
    generatedName = generatedName.replace("{playername}", playerName);
    generatedName = generatedName.replace("{guid}", randomUUID().replace(/-/g, ""));
    generatedName = generatedName.slice(0, 30);

    if (!nameSet.has(generatedName)) {
      name = generatedName;
      nameSet.add(generatedName);
      break;
    }
  }

  if (!name) {
    console.error(`YaCA: Couldn't generate a random name for player ${playerName} (ID: ${src}).`);
  }

  return name;
}
