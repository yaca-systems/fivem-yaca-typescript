# [yaca.systems](https://yaca.systems/) for [FiveM](https://fivem.net/)

This is a example implementation for [FiveM](https://fivem.net/).
Feel free to report bugs via issues or contribute via pull requests.

Join our [Discord](http://discord.yaca.systems/) to get help or make suggestions and start using [yaca.systems](https://yaca.systems/) today!

# Setup Steps
Before you start, make sure you have OneSync enabled and your server artifacts are up to date.

1. Download and install the lastest [release of ox_lib](https://github.com/overextended/ox_lib/releases/latest).
2. Download and install the latest [release](https://github.com/yaca-systems/fivem-yaca-typescript/releases) of this resource.
3. Add `start yaca-voice` into your `server.cfg`.
4. Open `config/server.json` and adjust the [variables](https://github.com/yaca-systems/fivem-yaca-typescript/blob/dev/README.md#server-config) to your needs.
5. Open `config/shared.json` and adjust the [variables](https://github.com/yaca-systems/fivem-yaca-typescript/blob/dev/README.md#shared-config) to your needs.

# Server Config
| Variable              | Type       | Description                                                                                                            |
|-----------------------|------------|------------------------------------------------------------------------------------------------------------------------|
| uniqueServerId        | `string`   | The unique Server Identifier of the Teamspeak-Server                                                                   |
| ingameChannelId       | `number`   | The ID of the Ingame Channel                                                                                           |
| ingameChannelPassword | `string`   | The Password used to join the Ingame Channel                                                                           |
| defaultChannelId      | `number`   | The ID of the Channel where a players should be moved to when leaving Ingame                                           |
| useWhisper            | `bool`     | If you want to use the Whisper functions of TeamSpeak, if set to `false` it mutes and unmutes the players              |
| excludeChannels       | `number[]` | The channels that should be able to join while being Ingame without instantly being moved back into the Ingame channel |

# Shared Config
| Variable                                | Type       | Description                                                                                                             |
|-----------------------------------------|------------|-------------------------------------------------------------------------------------------------------------------------|
| debug                                   | `bool`     | Enable the debug mode to enable some debug commands                                                                     |
| mufflingRange                           | `number`   | If set to -1, the player voice range is used, all values >= 0 sets the muffling range before it gets completely cut off |
| unmuteDelay                             | `number`   | The time before the teamspeak client is being unmuted after joining the ingame channel.                                 |
| maxPhoneSpeakerRange                    | `number`   | The range in which you can here the phone speaker when active.                                                          |
| notifications.oxLib                     | `bool`     | Enable or disable the notifications via ox_lib.                                                                         |
| notifications.gta                       | `bool`     | Enable or disable the notifications via default gta radar notifications.                                                |
| keyBinds.toggleRange                    | `string`   | The default keybind for changing the voice range.                                                                       |
| keyBinds.radioTransmit                  | `string`   | The default keybind for using the radio. (not available if the saltychat bridge is enabled)                             |
| keyBinds.megaphone                      | `string`   | The default keybinf for using the megaphone.                                                                            |
| maxRadioChannels                        | `number`   | Amount of Radio Channels available for the player.                                                                      |
| voiceRange.defaultIndex                 | `number`   | The default voice range that should be chosen when a player connects.                                                   |
| voiceRange.ranges                       | `number[]` | The available voice ranges which the player can change through.                                                         |
| megaphone.range                         | `number`   | The range in which the megaphone should be heard.                                                                       |
| megaphone.allowedVehicleClasses         | `number[]` | GTA Vehicle class ids that should be able to use the megaphone.                                                         |
| saltyChatBridge.enabled                 | `bool`     | If the saltychat bridge should be enabled or not.                                                                       |
| saltyChatBridge.keyBinds.primaryRadio   | `string`   | The default keybind for using the primary radio. (only available if the saltychat bridge is enabled)                    |
| saltyChatBridge.keyBinds.secondaryRadio | `string`   | The default keybind for using the secondary radio. (only available if the saltychat bridge is enabled)                  |

# Exports
## Client
## Server

# Events
## Client
## Server

# Developers
If you want to contribute to this project, feel free to do so. We are happy about every contribution. If you have any questions, feel free to ask in our [Discord](http://discord.yaca.systems/).

## Building the resource
To build the resource, you need to have [Node.js](https://nodejs.org/) installed. After that, you can run the following commands to build the resource:
```bash
pnpm install
pnpm run build
```
The built resource will be located in the `resource` folder, which you can then use in your FiveM server.