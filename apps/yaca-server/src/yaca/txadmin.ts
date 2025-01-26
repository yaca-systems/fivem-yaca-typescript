import { triggerClientEvent } from 'src/utils/events.js'

/**
 * The txadmin module for the server.
 */
export class YaCAServerTxAdminModule {
  /**
   * Creates an instance of the txadmin module.
   */
  constructor() {
    this.registerEvents()
  }

  /**
   * Register server events.
   */
  registerEvents() {
    /**
     * Handles the "txsv:req:spectate:end" event.
     */
    onNet('txsv:req:spectate:end', () => {
      triggerClientEvent('client:yaca:txadmin:stopspectate', source)
    })
  }
}
