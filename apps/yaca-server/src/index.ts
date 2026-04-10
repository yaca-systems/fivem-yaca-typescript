/// <reference types="@citizenfx/server" />

import { YaCAServerModule } from './yaca'

exports('isEnabled', () => GetConvarBool('yaca_enabled', true))

if (GetConvarBool('yaca_enabled', true)) {
    new YaCAServerModule()
} else {
    console.log('YaCA is disabled. Exiting...')
}
