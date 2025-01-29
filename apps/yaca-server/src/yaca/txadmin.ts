/**
 * The txadmin module for the server.
 */
export class YaCAServerTxAdminModule {
  /**
   * Creates an instance of the txadmin module.
   */
  constructor() {
    /**
     * Handles the "txsv:req:spectate:end" event.
     */
    onNet('txsv:req:spectate:end', () => {
      emitNet('client:yaca:txadmin:stopspectate', source)
    })
  }
}
