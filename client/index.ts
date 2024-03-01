import { YaCAClientModule } from "yaca.client";

on("onClientResourceStart", (resourceName: string) => {
  if (GetCurrentResourceName() !== resourceName) {
    return;
  }

  YaCAClientModule.getInstance(); // YACA Voiceplugin
});
