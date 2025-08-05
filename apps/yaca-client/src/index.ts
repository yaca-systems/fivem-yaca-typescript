/// <reference types="@citizenfx/client" />

import { initCache } from './utils'
import { YaCAClientModule } from './yaca'

exports('isEnabled', () => GetConvarBool('yaca_enabled', true))

if (GetConvarBool('yaca_enabled', true)) {
    initCache()
    new YaCAClientModule()
} else {
    console.log('YaCA is disabled. Exiting...')
}
