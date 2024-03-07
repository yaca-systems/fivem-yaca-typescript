import { cache, locale } from "@overextended/ox_lib/client";
import type { YaCAClientModule } from "yaca";
import { CommDeviceMode, YacaFilterEnum } from "types";
import { onCache } from "@overextended/ox_lib/server";

/* ======================== MEGAPHONE SYSTEM ======================== */
export class YaCAClientMegaphoneModule {
  clientModule: YaCAClientModule;

  canUseMegaphone: boolean = false;
  lastMegaphoneState: boolean = false;

  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
    this.registerKeybinds();
    this.registerStateBagHandlers();
  }

  registerEvents() {
    /**
     * Handles the "client:yaca:setLastMegaphoneState" server event.
     *
     * @param {boolean} state - The state of the megaphone.
     */
    onNet("client:yaca:setLastMegaphoneState", (state: boolean) => {
      this.lastMegaphoneState = state;
    });

    /**
     * Checks if the player can use the megaphone when they enter a vehicle.
     * If they can, it sets the `canUseMegaphone` property to `true`.
     * If they can't, it sets the `canUseMegaphone` property to `false`.
     * If the player is not in a vehicle, it sets the `canUseMegaphone` property to `false` and emits the "server:yaca:playerLeftVehicle" event.
     */
    onCache<number | false>("vehicle", (vehicle) => {
      if (vehicle) {
        const vehicleClass = GetVehicleClass(vehicle);

        this.canUseMegaphone =
          this.clientModule.sharedConfig.megaphone.allowedVehicleClasses.includes(
            vehicleClass,
          );
      } else if (this.canUseMegaphone) {
        this.canUseMegaphone = false;
        emitNet("server:yaca:playerLeftVehicle");
      }
    });
  }

  registerKeybinds() {
    /**
     * Registers the command and key mapping for the megaphone.
     */
    RegisterCommand(
      "+yaca:megaphone",
      () => {
        this.useMegaphone(true);
      },
      false,
    );
    RegisterCommand(
      "-yaca:megaphone",
      () => {
        this.useMegaphone(false);
      },
      false,
    );
    RegisterKeyMapping(
      "+yaca:megaphone",
      locale("use_megaphone")!,
      "keyboard",
      this.clientModule.sharedConfig.keyBinds.megaphone,
    );
  }

  registerStateBagHandlers() {
    /**
     * Handles the "yaca:megaphoneactive" state bag change.
     */
    AddStateBagChangeHandler(
      "yaca:megaphoneactive",
      "",
      (
        bagName: string,
        _: string,
        value: number | undefined,
        __: number,
        replicated: boolean,
      ) => {
        if (replicated) return;

        const playerId = GetPlayerFromStateBagName(bagName);
        if (playerId === 0) return;

        const playerSource = GetPlayerServerId(playerId);
        if (playerSource === 0) return;

        const isOwnPlayer = playerSource === cache.serverId;
        this.clientModule.setPlayersCommType(
          isOwnPlayer ? [] : this.clientModule.getPlayerByID(playerSource),
          YacaFilterEnum.MEGAPHONE,
          typeof value !== "undefined",
          undefined,
          value,
          isOwnPlayer ? CommDeviceMode.SENDER : CommDeviceMode.RECEIVER,
          isOwnPlayer ? CommDeviceMode.RECEIVER : CommDeviceMode.SENDER,
        );
      },
    );
  }

  /**
   * Toggles the use of the megaphone.
   *
   * @param {boolean} [state=false] - The state of the megaphone. Defaults to false if not provided.
   */
  useMegaphone(state: boolean = false) {
    if (
      !cache.vehicle ||
      !this.canUseMegaphone ||
      state === this.lastMegaphoneState
    )
      return;

    this.lastMegaphoneState = !this.lastMegaphoneState;
    emitNet("server:yaca:useMegaphone", state);
    emit("yaca:external:megaphoneState", state);
  }
}
