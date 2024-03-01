import { initLocale } from "@overextended/ox_lib/client";

initLocale();

export class YaCAClientModule {
  static instance: YaCAClientModule;

  /***
   * Gets the singleton of YaCAClientModule
   *
   * @returns {YaCAClientModule}
   */
  static getInstance(): YaCAClientModule {
    if (!this.instance) {
      this.instance = new YaCAClientModule();
    }

    return this.instance;
  }
}
