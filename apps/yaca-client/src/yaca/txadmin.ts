import type { YaCAClientModule } from './main'

/**
 * The txadmin module for the client.
 */
export class YaCAClientTxAdminModule {
  clientModule: YaCAClientModule
  spectating = false

  /**
   * Creates an instance of the txadmin module.
   *
   * @param clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule

    this.registerEvents()
  }

  /**
   * Register the txadmin events.
   */
  registerEvents() {
    /**
     * Handles the "txcl:spectate:start" server event.
     */
    onNet('txcl:spectate:start', () => {
      this.spectating = true
    })

    onNet('client:yaca:txadmin:stopspectate', () => {
      this.spectating = false
    })
  }
}
