import { YacaSharedConfig } from "types";
import { YaCAServerModule } from "yaca";

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
    const players = this.serverModule.getPlayers(),
      player = players.get(src);
    if (!player) {
      return;
    }

    const playerState = Player(src).state,
      playerPed = GetPlayerPed(src.toString()),
      playerVehicle = GetVehiclePedIsIn(playerPed, false);

    if (playerVehicle === 0 && playerState["yaca:megaphoneactive"]) {
      return;
    }
    if (playerVehicle !== 0) {
      const playerSeatDriver = GetPedInVehicleSeat(playerVehicle, -1),
        playerSeatPassenger = GetPedInVehicleSeat(playerVehicle, 0);
      if (playerSeatDriver !== playerPed && playerSeatPassenger !== playerPed) {
        return;
      }
    }
    if (
      (!state && !playerState["yaca:megaphoneactive"]) ||
      (state && playerState["yaca:megaphoneactive"])
    ) {
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

    if (!state && playerState["yaca:megaphoneactive"]) {
      playerState.set("yaca:megaphoneactive", null, true);
      if (forced) {
        emitNet("client:yaca:setLastMegaphoneState", src, false);
      }
    } else if (state && !playerState["yaca:megaphoneactive"]) {
      playerState.set(
        "yaca:megaphoneactive",
        this.sharedConfig.megaphone.range,
        true,
      );
    }
  }
}
