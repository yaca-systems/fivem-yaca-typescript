import { CommDeviceMode, YacaFilterEnum } from "types";
import { YaCAClientModule } from "yaca";
import { CLIENT_ID_STATE_NAME } from "common/const";

/**
 * The intercom module for the client.
 */
export class YaCAClientIntercomModule {
  clientModule: YaCAClientModule;

  /**
   * Creates an instance of the intercom module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
  }

  /**
   * Register the intercom events.
   */
  registerEvents() {
    /**
     * Handles the "client:yaca:addRemovePlayerIntercomFilter" server event.
     *
     * @param {Number[] | Number} playerIDs - The IDs of the players to be added or removed from the intercom filter.
     * @param {boolean} state - The state indicating whether to add or remove the players.
     */
    onNet("client:yaca:addRemovePlayerIntercomFilter", (playerIDs: number | number[], state: boolean) => {
      if (!Array.isArray(playerIDs)) {
        playerIDs = [playerIDs];
      }

      const playersToAddRemove: Set<number> = new Set();
      for (const playerID of playerIDs) {
        const playerState = Player(playerID).state;
        playersToAddRemove.add(playerState[CLIENT_ID_STATE_NAME]);
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
    });
  }
}
