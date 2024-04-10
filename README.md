# [yaca.systems](https://yaca.systems/) for [FiveM](https://fivem.net/)

This is a example implementation for [FiveM](https://fivem.net/).
Feel free to report bugs via issues or contribute via pull requests.

Join our [Discord](http://discord.yaca.systems/) to get help or make suggestions and start
using [yaca.systems](https://yaca.systems/) today!

# Setup Steps

Before you start, make sure you have OneSync enabled and your server artifacts are up to date.

1. Download and install the lastest [release of ox_lib](https://github.com/overextended/ox_lib/releases/latest).
2. Download and install the latest [release](https://github.com/yaca-systems/fivem-yaca-typescript/releases) of this
   resource.
3. Add `start yaca-voice` into your `server.cfg`.
4. Open `config/server.json` and adjust
   the [variables](https://github.com/yaca-systems/fivem-yaca-typescript/blob/dev/README.md#server-config) to your
   needs.
5. Open `config/shared.json` and adjust
   the [variables](https://github.com/yaca-systems/fivem-yaca-typescript/blob/dev/README.md#shared-config) to your
   needs.

# Server Config

| Variable              | Type       | Description                                                                                                            |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| uniqueServerId        | `string`   | The unique Server Identifier of the Teamspeak-Server                                                                   |
| ingameChannelId       | `number`   | The ID of the Ingame Channel                                                                                           |
| ingameChannelPassword | `string`   | The Password used to join the Ingame Channel                                                                           |
| defaultChannelId      | `number`   | The ID of the Channel where a players should be moved to when leaving Ingame                                           |
| useWhisper            | `boolean`  | If you want to use the Whisper functions of TeamSpeak, if set to `false` it mutes and unmutes the players              |
| excludeChannels       | `number[]` | The channels that should be able to join while being Ingame without instantly being moved back into the Ingame channel |

# Shared Config

| Variable                                | Type       | Description                                                                                                                                                                                                              |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| debug                                   | `boolean`  | Enable the debug mode to enable some debug commands                                                                                                                                                                      |
| buildType                               | `number`   | `0` for release and `1` for develop (develop allows using all yaca plugin version)                                                                                                                                       |
| locale                                  | `string`   | The locale that should be used preferred                                                                                                                                                                                 |
| unmuteDelay                             | `number`   | The time before the teamspeak client is being unmuted after joining the ingame channel.                                                                                                                                  |
| maxPhoneSpeakerRange                    | `number`   | The range in which you can here the phone speaker when active.                                                                                                                                                           |
| notifications.oxLib                     | `boolean`  | Enable or disable the notifications via ox_lib.                                                                                                                                                                          |
| notifications.gta                       | `boolean`  | Enable or disable the notifications via default gta radar notifications.                                                                                                                                                 |
| keyBinds.toggleRange                    | `string`   | The default keybind for changing the voice range, set to `false` to disable.                                                                                                                                             |
| keyBinds.radioTransmit                  | `string`   | The default keybind for using the radio, set to `false` to disable. (not available if the saltychat bridge is enabled)                                                                                                   |
| keyBinds.megaphone                      | `string`   | The default keybinf for using the megaphone, set to `false` to disable.                                                                                                                                                  |
| maxRadioChannels                        | `number`   | Amount of Radio Channels available for the player.                                                                                                                                                                       |
| voiceRange.defaultIndex                 | `number`   | The default voice range that should be chosen when a player connects.                                                                                                                                                    |
| voiceRange.ranges                       | `number[]` | The available voice ranges which the player can change through.                                                                                                                                                          |
| voiceRange.sendNotification             | `boolean`  | If a notification should be sent when the voice range is changed.                                                                                                                                                        |
| voiceRange.markerColor.enabled          | `boolean`  | If the voice range marker should be enabled or not.                                                                                                                                                                      |
| voiceRange.markerColor.r                | `number`   | The red value of the voice range marker color.                                                                                                                                                                           |
| voiceRange.markerColor.g                | `number`   | The green value of the voice range marker color.                                                                                                                                                                         |
| voiceRange.markerColor.b                | `number`   | The blue value of the voice range marker color.                                                                                                                                                                          |
| voiceRange.markerColor.a                | `number`   | The alpha value of the voice range marker color.                                                                                                                                                                         |
| voiceRange.markerColor.duration         | `number`   | The duration in milliseconds the voice range marker should be visible.                                                                                                                                                   |
| megaphone.range                         | `number`   | The range in which the megaphone should be heard.                                                                                                                                                                        |
| megaphone.allowedVehicleClasses         | `number[]` | GTA Vehicle class ids that should be able to use the megaphone.                                                                                                                                                          |
| saltyChatBridge.enabled                 | `boolean`  | If the saltychat bridge should be enabled or not.                                                                                                                                                                        |
| saltyChatBridge.keyBinds.primaryRadio   | `string`   | The default keybind for using the primary radio. (only available if the saltychat bridge is enabled)                                                                                                                     |
| saltyChatBridge.keyBinds.secondaryRadio | `string`   | The default keybind for using the secondary radio. (only available if the saltychat bridge is enabled)                                                                                                                   |
| vehicleMuffling                         | `boolean`  | If playes sitting in vehicles should be muffled when sitting inside a car without a window/door open. `true` to enable and `false` to disable                                                                            |
| mufflingRange                           | `number`   | If set to -1, the player voice range is used, all values >= 0 sets the muffling range before it gets completely cut off                                                                                                  |
| mufflingVehicleWhitelist                | `string[]` | Whitelist of vehicle models that should not be muffled when sitting inside a car without a window/door open.                                                                                                             |
| mufflingIntensities.differentRoom       | `number`   | Adjusts how much a nearby player is muffles when they are in a different room and not in line of sight. Values between 0 and 10 are possible, while 0 is no muffling and 10 is the most muffling.                        |
| mufflingIntensities.bothCarsClosed      | `number`   | Adjusts how much a nearby player is muffled when themself and the nearby player are in a car with closed windows/doors. Values between 0 and 10 are possible, while 0 is no muffling and 10 is the most muffling.        |
| mufflingIntensities.oneCarClosed        | `number`   | Adjusts how much a nearby player is muffled when either themself and the nearby player are in a car with closed windows/doors. Values between 0 and 10 are possible, while 0 is no muffling and 10 is the most muffling. |
| mufflingIntensities.megaPhoneInCar      | `number`   | Adjusts how much a nearby player is muffled when the player is using the megaphone and the nearby player is in a car. Values between 0 and 10 are possible, while 0 is no muffling and 10 is the most muffling.          |

# Exports

<details>
<summary style="font-size: x-large">Client</summary>

### General

#### `getVoiceRange()`

Get the current voice range of the player as `int`.

#### `getVoiceRanges()`

Get all voice ranges as `int[]`.

### Radio

#### `enableRadio(state: boolean)`

Enables or disables the radio system.

| Parameter | Type      | Description                                    |
| --------- | --------- | ---------------------------------------------- |
| state     | `boolean` | `true` to enable the radio, `false` to disable |

#### `changeRadioFrequency(frequency: string)`

Changes the radio frequency of the active channel.

| Parameter | Type     | Description                                |
| --------- | -------- | ------------------------------------------ |
| frequency | `string` | The frequency to set the active channel to |

#### `changeRadioFrequencyRaw(channel: number, frequency: string)`

Changes the radio frequency.

| Parameter | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| channel   | `number` | the channel number                  |
| frequency | `string` | the frequency to set the channel to |

#### `muteRadioChannel()`

Mutes the current active radio channel.

#### `muteRadioChannelRaw(channel: number)`

Mutes a radio channel.

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| channel   | `number` | the channel to mute |

#### `changeActiveRadioChannel(channel: number)`

Changes the active radio channel.

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| channel   | `number` | the new radio channel |

#### `getActiveRadioChannel(): number`

Returns the active radio channel as `number`.

#### `changeRadioChannelVolume(higher: boolean)`

Changes the volume of the active radio channel.

| Parameter | Type      | Description                    |
| --------- | --------- | ------------------------------ |
| higher    | `boolean` | whether to increase the volume |

#### `changeRadioChannelVolumeRaw(channel: number, volume: number)`

Changes the volume of a radio channel.

| Parameter | Type     | Description        |
| --------- | -------- | ------------------ |
| channel   | `number` | the channel number |
| volume    | `number` | the volume to set  |

#### `changeRadioChannelStereo`

Changes the stereo mode of the active radio channel.

#### `changeRadioChannelStereoRaw(channel: number, stereo: string)`

Changes the stereo mode of a radio channel.

| Parameter | Type     | Description                                                   |
| --------- | -------- | ------------------------------------------------------------- |
| channel   | `number` | the channel number                                            |
| stereo    | `string` | the stereo mode (`"MONO_LEFT"`, `"MONO_RIGHT"` or `"STEREO"`) |

#### `radioTalkingStart(state: boolean, channel: number, clearPedTasks: boolean = true)`

Starts or stops talking on the radio.

| Parameter     | Type      | Description                                                       |
| ------------- | --------- | ----------------------------------------------------------------- |
| state         | `boolean` | `true` to start talking, `false` to stop                          |
| channel       | `number`  | the channel to talk on                                            |
| clearPedTasks | `boolean` | `true` to clear the ped tasks, `false` to not clear the ped tasks |

</details>

<details>
<summary style="font-size: x-large">Server</summary>

### General

#### `getPlayerAliveStatus(source: number): bool`

Get the alive status of a player as `bool`.

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| source    | `number` | the player source |

#### `setPlayerAliveStatus(source: number, state: bool)`

Set the alive status of a player.

| Parameter | Type      | Description         |
| --------- | --------- | ------------------- |
| source    | `number`  | the player source   |
| state     | `boolean` | the new alive state |

#### `getPlayerVoiceRange(source: number): number`

Get the voice range of a player as `number`.

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| source    | `number` | the player source |

#### `setPlayerVoiceRange(source: number, range: number)`

Set the voice range of a player.

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| source    | `number` | the player source   |
| range     | `number` | the new voice range |

### Radio

#### `getPlayersInRadioFrequency(frequency: string): int[]`

Returns all players in a radio frequency as `int[]`.

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| frequency | `string` | the frequency to get |

#### `setPlayerRadioChannel(source: number, channel: number, frequency: string)`

Sets the radio channel of a player.

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| source    | `number` | the player source    |
| channel   | `number` | the channel to set   |
| frequency | `string` | the frequency to set |

#### `getPlayerHasLongRange(source: number): bool`

Returns whether a player has long range enabled as `bool`.

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| source    | `number` | the player source |

#### `setPlayerHasLongRange(source: number, state: bool)`

Sets the long range state of a player.

| Parameter | Type      | Description          |
| --------- | --------- | -------------------- |
| source    | `number`  | the player source    |
| state     | `boolean` | the long range state |

### Phone

#### `callPlayer(source: number, target: number, state: bool)`

Creates a phone call between two players.

| Parameter | Type      | Description              |
| --------- | --------- | ------------------------ |
| source    | `number`  | the player source        |
| target    | `number`  | the target player source |
| state     | `boolean` | the state of the call    |

#### `callPlayerOldEffect(source: number, target: number, state: bool)`

Creates a phone call between two players with the old effect.

| Parameter | Type      | Description              |
| --------- | --------- | ------------------------ |
| source    | `number`  | the player source        |
| target    | `number`  | the target player source |
| state     | `boolean` | the state of the call    |

#### `muteOnPhone(source: number, state: bool)`

Mutes the player when using the phone.

| Parameter | Type      | Description       |
| --------- | --------- | ----------------- |
| source    | `number`  | the player source |
| state     | `boolean` | the mute state    |

#### `enablePhoneSpeaker(source: number, state: bool)`

Enable or disable the phone speaker for a player.

| Parameter | Type      | Description             |
| --------- | --------- | ----------------------- |
| source    | `number`  | the player source       |
| state     | `boolean` | the phone speaker state |

</details>

# Events

<details>
<summary style="font-size: x-large">Client</summary>

### yaca:external:voiceRangeUpdate

This event is triggered when the voice range of a player is updated.

| Parameter | Type  | Description               |
| --------- | ----- | ------------------------- |
| range     | `int` | the newly set voice range |

### yaca:external:isTalking

The event is triggered when a player starts or stops talking.

| Parameter | Type      | Description           |
| --------- | --------- | --------------------- |
| state     | `boolean` | the new talking state |

### yaca:external:megaphoneState

The event is triggered when the megaphone state of a player changes.

| Parameter | Type      | Description             |
| --------- | --------- | ----------------------- |
| state     | `boolean` | the new megaphone state |

### yaca:external:setRadioMuteState

The event is triggered when the radio mute state of a player changes.

| Parameter | Type      | Description                                 |
| --------- | --------- | ------------------------------------------- |
| channel   | `number`  | the channel where the mute state is changed |
| state     | `boolean` | the new mute state                          |

### yaca:external:isRadioEnabled

The event is triggered when the radio state of a player changes.

| Parameter | Type      | Description                                                          |
| --------- | --------- | -------------------------------------------------------------------- |
| state     | `boolean` | `true` when the radio is enabled, `false` when the radio is disabled |

### yaca:external:changedActiveRadioChannel

The event is triggered when the active radio channel of a player changes.

| Parameter | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| channel   | `number` | the new active radio channel |

### yaca:external:setRadioVolume

The event is triggered when the radio volume of a player changes.

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| channel   | `number` | the channel to change |
| volume    | `number` | the new volume to set |

### yaca:external:setRadioChannelStereo

The event is triggered when the stereo mode of a radio channel changes.

| Parameter | Type     | Description                                                                                   |
| --------- | -------- | --------------------------------------------------------------------------------------------- |
| channel   | `number` | the channel to change                                                                         |
| stereo    | `string` | `"MONO_LEFT"` for the left ear, `"MONO_RIGHT"` for the right ear and `"STEREO"` for both ears |

### yaca:external:setRadioFrequency

The event is triggered when the radio frequency of a player changes.

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| channel   | `number` | the channel to set   |
| frequency | `string` | the frequency to set |

### yaca:external:isRadioTalking

The event is triggered when a player starts or stops talking on the radio.

| Parameter | Type      | Description                                |
| --------- | --------- | ------------------------------------------ |
| state     | `boolean` | the new talking state                      |
| channel   | `number`  | the channel where the player is talking at |

### yaca:external:isRadioReceiving

The event is triggered when a player starts or stops receiving on the radio.

| Parameter | Type      | Description                                    |
| --------- | --------- | ---------------------------------------------- |
| state     | `boolean` | the new receiver state                         |
| channel   | `number`  | the channel from which the player is receiving |

### yaca:external:notification

The event is triggered when a notification should be shown.

| Parameter | Type     | Description                                                  |
| --------- | -------- | ------------------------------------------------------------ |
| message   | `string` | the message to show                                          |
| type      | `string` | the type of the message (`"inform"`, `"error"`, `"success"`) |

Example for custom notification:

```lua
AddEventHandler('yaca:external:notification', function (message, type)
  -- Call your Notifications System here.
end)
```

</details>

<details>
<summary style="font-size: x-large">Server</summary>

### yaca:external:changeMegaphoneState

The event is triggered when the megaphone state of a player changes.

| Parametr | Type      | Description             |
| -------- | --------- | ----------------------- |
| source   | `int`     | the player source       |
| state    | `boolean` | the new megaphone state |

### yaca:external:phoneCall

The event is triggered when a phone call is started or ended.

| Parameter | Type      | Description              |
| --------- | --------- | ------------------------ |
| source    | `int`     | the player source        |
| target    | `int`     | the target player source |
| state     | `boolean` | the new phone call state |

### yaca:external:phoneCallOldEffect

The event is triggered when a phone call with the old effect is started or ended.

| Parameter | Type      | Description              |
| --------- | --------- | ------------------------ |
| source    | `int`     | the player source        |
| target    | `int`     | the target player source |
| state     | `boolean` | the new phone call state |

### yaca:external:phoneSpeaker

The event is triggered when the phone speaker state of a player changes.

| Parameter | Type      | Description                 |
| --------- | --------- | --------------------------- |
| source    | `int`     | the player source           |
| state     | `boolean` | the new phone speaker state |

### yaca:external:changedRadioFrequency

The event is triggered when the radio frequency of a player changes.

| Parameter | Type     | Description                             |
| --------- | -------- | --------------------------------------- |
| source    | `int`    | the player source                       |
| channel   | `int`    | the channel where the frequency was set |
| frequency | `string` | the frequency to set                    |

### yaca:external:changedRadioMuteState

The event is triggered when the radio mute state of a player changes.

| Parameter | Type      | Description                                  |
| --------- | --------- | -------------------------------------------- |
| source    | `int`     | the player source                            |
| channel   | `int`     | the channel where the mute state was changed |
| state     | `boolean` | the new mute state                           |

### yaca:external:changedRadioActiveChannel

The event is triggered when the active radio channel of a player changes.

| Parameter | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| source    | `int`    | the player source            |
| channel   | `number` | the new active radio channel |

</details>

# Developers

If you want to contribute to this project, feel free to do so. We are happy about every contribution. If you have any
questions, feel free to ask in our [Discord](http://discord.yaca.systems/).

## Building the resource

To build the resource, you need to have [Node.js](https://nodejs.org/) installed. After that, you can run the following
commands to build the resource:

```bash
pnpm install
pnpm run build
```

The built resource will be located in the `resource` folder, which you can then use in your FiveM server.
