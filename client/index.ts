import { YaCAClientModule } from "yaca";

on("onClientResourceStart", (resourceName: string) => {
  if (GetCurrentResourceName() !== resourceName) {
    return;
  }

  new YaCAClientModule();
});
