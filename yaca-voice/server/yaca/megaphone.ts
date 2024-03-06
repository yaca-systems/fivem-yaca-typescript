import { YacaServerConfig } from "types";
import { YaCAServerModule } from "yaca";

export class YaCAServerMegaphoneModule {
  private serverModule: YaCAServerModule;
  private serverConfig: YacaServerConfig;

  constructor(serverModule: YaCAServerModule) {
    this.serverModule = serverModule;
    this.serverConfig = serverModule.serverConfig;

    this.registerEvents()
  }

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
    const players = this.serverModule.getPlayers();
    const player = players.get(src);
    if (!player) return;

    const playerState = Player(src).state;
    const playerPed = GetPlayerPed(src.toString());
    const playerVehicle = GetVehiclePedIsIn(playerPed, false);

    if (playerVehicle == 0 && playerState["yaca:megaphoneactive"]) return;
    if (playerVehicle != 0) {
      const playerSeatDriver = GetPedInVehicleSeat(playerVehicle, -1);
      const playerSeatPassenger = GetPedInVehicleSeat(playerVehicle, 0);
      if (playerSeatDriver != playerPed && playerSeatPassenger != playerPed)
        return;
    }
    if (
      (!state && !playerState["yaca:megaphoneactive"]) ||
      (state && playerState["yaca:megaphoneactive"])
    )
      return;

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
  changeMegaphoneState(src: number, state: boolean, forced: boolean = false) {
    const playerState = Player(src).state;

    if (!state && playerState["yaca:megaphoneactive"]) {
      playerState.set("yaca:megaphoneactive", null, true);
      if (forced) emitNet("client:yaca:setLastMegaphoneState", src, false);
    } else if (state && !playerState["yaca:megaphoneactive"]) {
      playerState.set(
        "yaca:megaphoneactive",
        this.serverConfig.megaPhoneRange,
        true,
      );
    }
  }
}
