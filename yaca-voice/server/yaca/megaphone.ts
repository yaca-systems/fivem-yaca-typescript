import { YacaSharedConfig } from "types";
import { YaCAServerModule } from "yaca";
import { MEGAPHONE_STATE_NAME } from "common/constants";

/**
 * The server-side megaphone module.
 */
export class YaCAServerMegaphoneModule {
  private serverModule: YaCAServerModule;
  private sharedConfig: YacaSharedConfig;

  /**
   * Creates an instance of the megaphone module.
   *
   * @param serverModule - The server module.
   */
  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;
    this.sharedConfig = serverModule.sharedConfig;

    this.registerEvents();
  }

  /**
   * Register server events.
   */
  registerEvents() {
    /**
     * Changes megaphone state by player
     *
     * @param {boolean} state - The state of the megaphone effect.
     */
    onNet("server:yaca:useMegaphone", (state: boolean) => {
      this.playerUseMegaphone(source, state);
    });
  }

  /**
   * Apply the megaphone effect on a specific player via client event.
   *
   * @param {number} src - The source-id of the player to apply the megaphone effect to.
   * @param {boolean} state - The state of the megaphone effect.
   */
  playerUseMegaphone(src: number, state: boolean) {
    const player = this.serverModule.getPlayer(src);
    if (!player) {
      return;
    }

    const playerState = Player(src).state,
      playerPed = GetPlayerPed(src.toString()),
      playerVehicle = GetVehiclePedIsIn(playerPed, false);

    if (playerVehicle === 0 && !playerState[MEGAPHONE_STATE_NAME]) {
      return;
    }

    if (playerVehicle !== 0) {
      if (GetPedInVehicleSeat(playerVehicle, -1) !== playerPed && GetPedInVehicleSeat(playerVehicle, 0) !== playerPed) {
        return;
      }
    }

    if ((!state && !playerState[MEGAPHONE_STATE_NAME]) || (state && playerState[MEGAPHONE_STATE_NAME])) {
      return;
    }

    this.changeMegaphoneState(src, state);
    emit("yaca:external:changeMegaphoneState", src, state);
  }

  /**
   * Apply the megaphone effect on a specific player.
   *
   * @param {number} src - The source-id of the player to apply the megaphone effect to.
   * @param {boolean} state - The state of the megaphone effect.
   * @param {boolean} [forced=false] - Whether the change is forced. Defaults to false if not provided.
   */
  changeMegaphoneState(src: number, state: boolean, forced = false) {
    const playerState = Player(src).state;

    if (!state && playerState[MEGAPHONE_STATE_NAME]) {
      playerState.set(MEGAPHONE_STATE_NAME, undefined, true);
      if (forced) {
        emitNet("client:yaca:setLastMegaphoneState", src, false);
      }
    } else if (state && !playerState[MEGAPHONE_STATE_NAME]) {
      playerState.set(MEGAPHONE_STATE_NAME, this.sharedConfig.megaphone.range, true);
    }
  }
}
