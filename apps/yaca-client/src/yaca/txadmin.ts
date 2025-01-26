import type { YaCAClientModule } from './main'

/**
 * The txadmin module for the client.
 */
export class YaCAClientTxAdminModule {
  clientModule: YaCAClientModule
  spectating: number | false = false

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
    onNet('txcl:spectate:start', (targetServerId: number) => {
      this.spectating = targetServerId
    })

    onNet('client:yaca:txadmin:stopspectate', () => {
      this.spectating = false
    })
  }
}
