import { CommDeviceMode, YacaFilterEnum, YacaPlayerData } from "types";
import { YaCAClientModule } from "yaca";

/* =========== INTERCOM SYSTEM =========== */
export class YaCAClientIntercomModule {
  clientModule: YaCAClientModule;

  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
  }

  registerEvents() {
    /**
     * Handles the "client:yaca:addRemovePlayerIntercomFilter" server event.
     *
     * @param {Number[] | Number} playerIDs - The IDs of the players to be added or removed from the intercom filter.
     * @param {boolean} state - The state indicating whether to add or remove the players.
     */
    onNet(
      "client:yaca:addRemovePlayerIntercomFilter",
      (playerIDs: number | number[], state: boolean) => {
        if (!Array.isArray(playerIDs)) {
          playerIDs = [playerIDs];
        }

        const playersToAddRemove: Set<YacaPlayerData> = new Set();
        for (const playerID of playerIDs) {
          const player = this.clientModule.getPlayerByID(playerID);
          if (!player) {
            continue;
          }
          playersToAddRemove.add(player);
        }

        if (playersToAddRemove.size < 1) {
          return;
        }
        this.clientModule.setPlayersCommType(
          Array.from(playersToAddRemove),
          YacaFilterEnum.INTERCOM,
          state,
          undefined,
          undefined,
          CommDeviceMode.TRANSCEIVER,
          CommDeviceMode.TRANSCEIVER,
        );
      },
    );
  }
}
