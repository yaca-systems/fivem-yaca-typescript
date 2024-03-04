import { cache } from "@overextended/ox_lib/client";
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
    onNet("client:yaca:setLastMegaphoneState", (state: boolean) => {
      this.lastMegaphoneState = state;
    });

    onCache<number | false>("vehicle", (vehicle) => {
      if (vehicle) {
        const vehicleClass = GetVehicleClass(vehicle);

        this.canUseMegaphone =
          this.clientModule.sharedConfig.megaphoneAllowedVehicleClasses.includes(
            vehicleClass,
          );
      } else {
        this.canUseMegaphone = false;
        emitNet("server:yaca:playerLeftVehicle");
      }
    });
  }

  registerKeybinds() {
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
    RegisterKeyMapping("+yaca:megaphone", "Megaphone", "keyboard", "M");
  }

  registerStateBagHandlers() {
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
        if (playerId == 0) return;

        const playerSource = GetPlayerServerId(playerId);
        if (playerSource == 0) return;

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
      state == this.lastMegaphoneState
    )
      return;

    this.lastMegaphoneState = !this.lastMegaphoneState;
    emitNet("server:yaca:useMegaphone", state);
  }
}
