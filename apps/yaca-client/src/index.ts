/// <reference types="@citizenfx/client" />

import { YaCAClientModule } from "./yaca";
import { initCache } from "./utils";

initCache();

new YaCAClientModule();
