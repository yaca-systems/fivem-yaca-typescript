import { initLocale } from "@overextended/ox_lib/server";

initLocale();

export class YaCAServerModule {
  static instance: YaCAServerModule;

  /**
   * Gets the singleton of YaCAServerModule.
   *
   * @returns {YaCAServerModule} The singleton instance of YaCAServerModule.
   */
  static getInstance(): YaCAServerModule {
    if (!this.instance) {
      this.instance = new YaCAServerModule();
    }

    return this.instance;
  }
}
