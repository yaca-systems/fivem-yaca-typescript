import { getRandomString } from "@overextended/ox_lib/server";
import { YaCAServerModule } from "yaca";

/**
 * Generate a random name and insert it into the database.
 *
 * @param src The ID of the player.
 */
export function generateRandomName(src: number): string | undefined {
  let name: string | undefined;
  for (let i = 0; i < 10; i++) {
    let generatedName = `[${src}] - ${getRandomString("...............", 15)}`;
    generatedName = generatedName.slice(0, 30);
    if (!YaCAServerModule.nameSet.has(generatedName)) {
      name = generatedName;
      YaCAServerModule.nameSet.add(generatedName);
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
