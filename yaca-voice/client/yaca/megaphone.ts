import type { YaCAClientModule } from "yaca";
import { CommDeviceMode, YacaFilterEnum } from "types";
import { locale } from "common/locale";
import { cache, onCache, registerRdrKeyBind } from "utils";
import { MEGAPHONE_STATE_NAME } from "common/constants";

/**
 * The megaphone module for the client.
 */
export class YaCAClientMegaphoneModule {
  clientModule: YaCAClientModule;

  canUseMegaphone = false;
  lastMegaphoneState = false;

  /**
   * Creates an instance of the megaphone module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule;

    this.registerEvents();
    if (this.clientModule.isFiveM) {
      this.registerKeybinds();
    } else if (this.clientModule.isRedM) {
      this.registerRdrKeybinds();
    }
    this.registerExports();
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

    const autoDetect = this.clientModule.sharedConfig.megaphone.automaticVehicleDetection ?? true;
    if (this.clientModule.isFiveM && autoDetect) {
      /**
       * Checks if the player can use the megaphone when they enter a vehicle.
       * If they can, it sets the `canUseMegaphone` property to `true`.
       * If they can't, it sets the `canUseMegaphone` property to `false`.
       * If the player is not in a vehicle, it sets the `canUseMegaphone` property to `false` and emits the "server:yaca:playerLeftVehicle" event.
       */
      onCache<number | false>("seat", (seat) => {
        if (!seat || seat > 0 || !cache.vehicle) {
          this.canUseMegaphone = false;
          emitNet("server:yaca:playerLeftVehicle");
          return;
        }

        const vehicleClass = GetVehicleClass(cache.vehicle);
        this.canUseMegaphone = this.clientModule.sharedConfig.megaphone.allowedVehicleClasses.includes(vehicleClass);
      });
    }
  }

  /**
   * Registers the command and key mapping for the megaphone.
   * This is only available in FiveM.
   */
  registerKeybinds() {
    if (this.clientModule.sharedConfig.keyBinds.megaphone === false) {
      return;
    }

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
    RegisterKeyMapping("+yaca:megaphone", locale("use_megaphone"), "keyboard", this.clientModule.sharedConfig.keyBinds.megaphone);
  }

  /**
   * Registers the keybindings for the megaphone.
   * This is only available in RedM.
   */
  registerRdrKeybinds() {
    if (this.clientModule.sharedConfig.keyBinds.megaphone === false) {
      return;
    }

    /**
     * Registers the command and key mapping for the megaphone.
     */
    registerRdrKeyBind(this.clientModule.sharedConfig.keyBinds.megaphone, () => {
      this.useMegaphone(!this.lastMegaphoneState);
    });
  }

  registerExports() {
    /**
     * Gets the `canUseMegaphone` property.
     *
     * @returns {boolean} - The `canUseMegaphone` property.
     */
    exports("getCanUseMegaphone", () => {
      return this.canUseMegaphone;
    });

    exports("setCanUseMegaphone", (state: boolean) => {
      this.canUseMegaphone = state;

      if (!state && this.lastMegaphoneState) {
        emitNet("server:yaca:playerLeftVehicle");
      }
    });
  }

  registerStateBagHandlers() {
    /**
     * Handles the megaphone state bag change.
     */
    AddStateBagChangeHandler(MEGAPHONE_STATE_NAME, "", (bagName: string, _: string, value: number | undefined, __: number, replicated: boolean) => {
      if (replicated) {
        return;
      }

      const playerId = GetPlayerFromStateBagName(bagName);
      if (playerId === 0) {
        return;
      }

      const playerSource = GetPlayerServerId(playerId);
      if (playerSource === 0) {
        return;
      }

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
    });
  }

  /**
   * Toggles the use of the megaphone.
   *
   * @param {boolean} [state=false] - The state of the megaphone. Defaults to false if not provided.
   */
  useMegaphone(state = false) {
    if (!cache.vehicle || !this.canUseMegaphone || state === this.lastMegaphoneState) {
      return;
    }

    this.lastMegaphoneState = !this.lastMegaphoneState;
    emitNet("server:yaca:useMegaphone", state, this.clientModule.isRedM);
    emit("yaca:external:megaphoneState", state);
  }
}
