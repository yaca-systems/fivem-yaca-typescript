# [yaca.systems](https://yaca.systems/) for [FiveM](https://fivem.net/) & [RedM](https://redm.net/)

This is a example implementation for [FiveM](https://fivem.net/) & [RedM](https://redm.net/).
Feel free to report bugs via issues or contribute via pull requests.

Join our [Discord](http://discord.yaca.systems/) to get help or make suggestions and start
using [yaca.systems](https://yaca.systems/) today!

# Setup Steps

Before you start, make sure you have OneSync enabled and your server artifacts are up to date.

1. Download and install the latest [release](https://github.com/yaca-systems/fivem-yaca-typescript/releases) of this
   resource.
2. Add `start yaca-voice` into your `server.cfg`.
3. Open `config/server.json5` and adjust the variables to your needs.
4. Open `config/shared.json5` and adjust the variables to your needs.

# Exports

<details>
<summary style="font-size: x-large">Client</summary>

### General

#### `getVoiceRange(): int`

Get the current voice range of the player as `int`.

#### `getVoiceRanges(): int[]`

Get all voice ranges as `int[]`.

#### `changeVoiceRange(increase: boolean): void`

Change the voice range of the player.

#### `getMicrophoneMuteState(): boolean`

Get the microphone mute state of the player as `boolean`.

#### `getMicrophoneDisabledState(): boolean`

Get the microphone disabled state of the player as `boolean`.

#### `getSoundMuteState(): boolean`

Get the sound mute state of the player as `boolean`.

#### `getSoundDisabledState(): boolean`

Get the sound disabled state of the player as `boolean`.

#### `getPluginState(): string`

Get the current plugin state as `string`.

The state can be one of the following:

- `"NOT_CONNECTED"`: The plugin is not connected
- `"CONNECTED`: The plugin is connected
- `"OUTDATED_VERSION"`: The plugin is not the version set in the dashboard
- `"WRONG_TS_SERVER"`: The user is connected to the wrong Teamspeak server
- `"IN_INGAME_CHANNEL"`: The user is in the ingame channel
- `"IN_EXCLUDED_CHANNEL"`: The user is in an excluded channel

#### `getGlobalErrorLevel(): number`

Get the global error level as `number`.

#### `setSpectatingPlayer(playerId: number | false)`

Set the player to spectate.

| Parameter | Type              | Description       |
|-----------|-------------------|-------------------|
| playerId  | `number \| false` | the player to set |

#### `getSpectatingPlayer(): number`

Get the player the user is spectating as `number`.

### Radio

#### `enableRadio(state: boolean)`

Enables or disables the radio system.

| Parameter | Type      | Description                                    |
|-----------|-----------|------------------------------------------------|
| state     | `boolean` | `true` to enable the radio, `false` to disable |

#### `isRadioEnabled(): boolean`

Returns whether the radio system is enabled as `boolean`.

#### `changeRadioFrequency(frequency: string)`

Changes the radio frequency of the active channel.

| Parameter | Type     | Description                                |
|-----------|----------|--------------------------------------------|
| frequency | `string` | The frequency to set the active channel to |

#### `changeRadioFrequencyRaw(channel: number, frequency: string)`

Changes the radio frequency.

| Parameter | Type     | Description                                                                           |
|-----------|----------|---------------------------------------------------------------------------------------|
| channel?  | `number` | the channel number. Defaults to the current active channel when no channel is passed. |
| frequency | `string` | the frequency to set the channel to                                                   |

#### `getRadioFrequency(channel: number): string`

Returns the frequency of a radio channel as `string`.

| Parameter | Type     | Description                                                                           |
|-----------|----------|---------------------------------------------------------------------------------------|
| channel?  | `number` | the channel number. Defaults to the current active channel when no channel is passed. |

#### `muteRadioChannel()`

Mutes the current active radio channel.

#### `muteRadioChannelRaw(channel: number):ol`

Mutes a radio channel.

| Parameter | Type     | Description                                                                            |
|-----------|----------|----------------------------------------------------------------------------------------|
| channel?  | `number` | the channel to mute. Defaults to the current active channel when no channel is passed. |

#### `isRadioChannelMuted(channel: number): boolean`

Returns whether a radio channel is muted as `boolean`.

| Parameter | Type     | Description        |
|-----------|----------|--------------------|
| channel   | `number` | the channel number |

#### `setActiveRadioChannel(channel: number): bool`

Changes the active radio channel. Returns whether the operation was successful as `bool`.

| Parameter | Type     | Description           |
|-----------|----------|-----------------------|
| channel   | `number` | the new radio channel |

#### `getActiveRadioChannel(): number`

Returns the active radio channel as `number`.

#### `setSecondaryRadioChannel(channel: number): bool`

Changes the secondary radio channel. Returns whether the operation was successful as `bool`.

| Parameter | Type     | Description           |
|-----------|----------|-----------------------|
| channel   | `number` | the new radio channel |

#### `getSecondaryRadioChannel(): number`

Returns the secondary radio channel as `number`.

#### `changeRadioChannelVolume(higher: boolean): bool`

Changes the volume of the active radio channel. Returns whether the operation was successful as `bool`.

| Parameter | Type      | Description                    |
|-----------|-----------|--------------------------------|
| higher    | `boolean` | whether to increase the volume |

#### `changeRadioChannelVolumeRaw(channel: number, volume: number): bool`

Changes the volume of a radio channel. Returns whether the operation was successful as `bool`.

| Parameter | Type     | Description        |
|-----------|----------|--------------------|
| channel   | `number` | the channel number |
| volume    | `number` | the volume to set  |

#### `getRadioChannelVolume(channel: number): number`

Returns the volume of a radio channel as `number`.

| Parameter | Type     | Description        |
|-----------|----------|--------------------|
| channel   | `number` | the channel number |

#### `changeRadioChannelStereo(): bool`

Changes the stereo mode of the active radio channel. Returns whether the operation was successful as `bool`.

#### `changeRadioChannelStereoRaw(channel: number, stereo: string): bool`

Changes the stereo mode of a radio channel. Returns whether the operation was successful as `bool`.

| Parameter | Type     | Description                                                   |
|-----------|----------|---------------------------------------------------------------|
| channel   | `number` | the channel number                                            |
| stereo    | `string` | the stereo mode (`"MONO_LEFT"`, `"MONO_RIGHT"` or `"STEREO"`) |

#### `getRadioChannelStereo(channel: number): string`

Returns the stereo mode of a radio channel as `string`.

| Parameter | Type     | Description        |
|-----------|----------|--------------------|
| channel   | `number` | the channel number |

#### `radioTalkingStart(state: boolean, channel: number)`

Starts or stops talking on the radio.

| Parameter | Type      | Description                              |
|-----------|-----------|------------------------------------------|
| state     | `boolean` | `true` to start talking, `false` to stop |
| channel   | `number`  | the channel to talk on                   |

### Phone

#### `isInCall(): boolean`

Returns whether the player is in a phone call as a `boolean`.

### Megaphone

#### `getCanUseMegaphone(): boolean`

Returns whether the player can use the megaphone as a `boolean`.

#### `setCanUseMegaphone(state: boolean)`

Sets whether the player can use the megaphone.

| Parameter | Type      | Description                                             |
|-----------|-----------|---------------------------------------------------------|
| state     | `boolean` | `true` to allow using of megaphone, `false` to disallow |

### `useMegaphone(state: boolean)`

Starts or stops using the megaphone.

| Parameter | Type      | Description                            |
|-----------|-----------|----------------------------------------|
| state     | `boolean` | `true` to start using, `false` to stop |

</details>

<details>
<summary style="font-size: x-large">Server</summary>

### General

#### `getPlayerAliveStatus(source: number): bool`

Get the alive status of a player as `bool`.

| Parameter | Type     | Description       |
|-----------|----------|-------------------|
| source    | `number` | the player source |

#### `setPlayerAliveStatus(source: number, state: bool)`

Set the alive status of a player.

| Parameter | Type      | Description         |
|-----------|-----------|---------------------|
| source    | `number`  | the player source   |
| state     | `boolean` | the new alive state |

#### `getPlayerVoiceRange(source: number): number`

Get the voice range of a player as `number`.

| Parameter | Type     | Description       |
|-----------|----------|-------------------|
| source    | `number` | the player source |

#### `setPlayerVoiceRange(source: number, range: number)`

Set the voice range of a player.

| Parameter | Type     | Description                                                               |
|-----------|----------|---------------------------------------------------------------------------|
| source    | `number` | the player source                                                         |
| range     | `number` | The new voice range. Defaults to the default voice range if not provided. |

### Radio

#### `getPlayersInRadioFrequency(frequency: string): int[]`

Returns all players in a radio frequency as `int[]`.

| Parameter | Type     | Description          |
|-----------|----------|----------------------|
| frequency | `string` | the frequency to get |

#### `setPlayerRadioChannel(source: number, channel: number, frequency: string)`

Sets the radio channel of a player.

| Parameter | Type     | Description          |
|-----------|----------|----------------------|
| source    | `number` | the player source    |
| channel   | `number` | the channel to set   |
| frequency | `string` | the frequency to set |

#### `getPlayerHasLongRange(source: number): bool`

Returns whether a player has long range enabled as `bool`.

| Parameter | Type     | Description       |
|-----------|----------|-------------------|
| source    | `number` | the player source |

#### `setPlayerHasLongRange(source: number, state: bool)`

Sets the long range state of a player.

| Parameter | Type      | Description          |
|-----------|-----------|----------------------|
| source    | `number`  | the player source    |
| state     | `boolean` | the long range state |

### Phone

#### `callPlayer(source: number, target: number, state: bool)`

Creates a phone call between two players.

| Parameter | Type      | Description              |
|-----------|-----------|--------------------------|
| source    | `number`  | the player source        |
| target    | `number`  | the target player source |
| state     | `boolean` | the state of the call    |

#### `callPlayerOldEffect(source: number, target: number, state: bool)`

Creates a phone call between two players with the old effect.

| Parameter | Type      | Description              |
|-----------|-----------|--------------------------|
| source    | `number`  | the player source        |
| target    | `number`  | the target player source |
| state     | `boolean` | the state of the call    |

#### `muteOnPhone(source: number, state: bool)`

Mutes the player when using the phone.

| Parameter | Type      | Description       |
|-----------|-----------|-------------------|
| source    | `number`  | the player source |
| state     | `boolean` | the mute state    |

#### `enablePhoneSpeaker(source: number, state: bool)`

Enable or disable the phone speaker for a player.

| Parameter | Type      | Description             |
|-----------|-----------|-------------------------|
| source    | `number`  | the player source       |
| state     | `boolean` | the phone speaker state |

#### `isPlayerInCall(source: number): [bool, number[]]`

Returns whether a player is in a phone call as `[bool, number[]]`.

| Parameter | Type     | Description       |
|-----------|----------|-------------------|
| source    | `number` | the player source |

#### `setGlobalErrorLevel(level: number)`

Sets the global error level.

| Parameter | Type     | Description     |
|-----------|----------|-----------------|
| level     | `number` | the error level |

#### `getGlobalErrorLevel(): number`

Returns the global error level as `number`.

</details>

# Events

<details>
<summary style="font-size: x-large">Client</summary>

### yaca:external:pluginInitialized

The event is triggered when the plugin is initialized.

| Parameter | Type  | Description                                  |
|-----------|-------|----------------------------------------------|
| clientId  | `int` | the client id of the local user in teamspeak |

### yaca:external:pluginStateChanged

The event is triggered when the plugin state changes.

| Parameter | Type     | Description                                  |
|-----------|----------|----------------------------------------------|
| state     | `string` | the current plugin state, as explained below |

The state can be one of the following:

- `"NOT_CONNECTED"`: The plugin is not connected
- `"CONNECTED`: The plugin is connected
- `"OUTDATED_VERSION"`: The plugin is not the version set in the dashboard
- `"WRONG_TS_SERVER"`: The user is connected to the wrong Teamspeak server
- `"IN_INGAME_CHANNEL"`: The user is in the ingame channel
- `"IN_EXCLUDED_CHANNEL"`: The user is in an excluded channel

### yaca:external:voiceRangeUpdate

This event is triggered when the voice range of a player is updated.

| Parameter  | Type  | Description               |
|------------|-------|---------------------------|
| range      | `int` | the newly set voice range |
| rangeIndex | `int` | the index of the range    |

### yaca:external:muteStateChanged

DEPRECATED: Use `yaca:external:microphoneMuteStateChanged` instead.
The event is triggered when the mute state of a player changes.

| Parameter | Type      | Description        |
|-----------|-----------|--------------------|
| state     | `boolean` | the new mute state |

### yaca:external:microphoneMuteStateChanged

The event is triggered when the microphone mute state of a player changes.

| Parameter | Type      | Description        |
|-----------|-----------|--------------------|
| state     | `boolean` | the new mute state |

### yaca:external:microphoneDisabledStateChanged

The event is triggered when the microphone disabled state of a player changes.

| Parameter | Type      | Description        |
|-----------|-----------|--------------------|
| state     | `boolean` | the new mute state |

### yaca:external:soundMuteStateChanged

The event is triggered when the sound mute state of a player changes.

| Parameter | Type      | Description        |
|-----------|-----------|--------------------|
| state     | `boolean` | the new mute state |

### yaca:external:soundDisabledStateChanged

The event is triggered when the sound disabled state of a player changes.

| Parameter | Type      | Description        |
|-----------|-----------|--------------------|
| state     | `boolean` | the new mute state |

### yaca:external:isTalking

The event is triggered when a player starts or stops talking.

| Parameter | Type      | Description           |
|-----------|-----------|-----------------------|
| state     | `boolean` | the new talking state |

### yaca:external:megaphoneState

The event is triggered when the megaphone state of a player changes.

| Parameter | Type      | Description             |
|-----------|-----------|-------------------------|
| state     | `boolean` | the new megaphone state |

### yaca:external:setRadioMuteState

The event is triggered when the radio mute state of a player changes.

| Parameter | Type      | Description                                 |
|-----------|-----------|---------------------------------------------|
| channel   | `number`  | the channel where the mute state is changed |
| state     | `boolean` | the new mute state                          |

### yaca:external:isRadioEnabled

The event is triggered when the radio state of a player changes.

| Parameter | Type      | Description                                                          |
|-----------|-----------|----------------------------------------------------------------------|
| state     | `boolean` | `true` when the radio is enabled, `false` when the radio is disabled |

### yaca:external:changedActiveRadioChannel

The event is triggered when the active radio channel of a player changes.

| Parameter | Type     | Description                  |
|-----------|----------|------------------------------|
| channel   | `number` | the new active radio channel |

### yaca:external:changedSecondaryRadioChannel

The event is triggered when the secondary radio channel of a player changes.

| Parameter | Type     | Description                                       |
|-----------|----------|---------------------------------------------------|
| channel   | `number` | the new active radio channel, or `-1` if disabled |

### yaca:external:setRadioVolume

The event is triggered when the radio volume of a player changes.

| Parameter | Type     | Description           |
|-----------|----------|-----------------------|
| channel   | `number` | the channel to change |
| volume    | `number` | the new volume to set |

### yaca:external:setRadioChannelStereo

The event is triggered when the stereo mode of a radio channel changes.

| Parameter | Type     | Description                                                                                   |
|-----------|----------|-----------------------------------------------------------------------------------------------|
| channel   | `number` | the channel to change                                                                         |
| stereo    | `string` | `"MONO_LEFT"` for the left ear, `"MONO_RIGHT"` for the right ear and `"STEREO"` for both ears |

### yaca:external:setRadioFrequency

The event is triggered when the radio frequency of a player changes.

| Parameter | Type     | Description          |
|-----------|----------|----------------------|
| channel   | `number` | the channel to set   |
| frequency | `string` | the frequency to set |

### yaca:external:isRadioTalking

The event is triggered when a player starts or stops talking on the radio.

| Parameter | Type      | Description                                |
|-----------|-----------|--------------------------------------------|
| state     | `boolean` | the new talking state                      |
| channel   | `number`  | the channel where the player is talking at |

### yaca:external:isRadioReceiving

The event is triggered when a player starts or stops receiving on the radio.

| Parameter | Type      | Description                                    |
|-----------|-----------|------------------------------------------------|
| state     | `boolean` | the new receiver state                         |
| channel   | `number`  | the channel from which the player is receiving |

### yaca:external:notification

The event is triggered when a notification should be shown.

| Parameter | Type     | Description                                                  |
|-----------|----------|--------------------------------------------------------------|
| message   | `string` | the message to show                                          |
| type      | `string` | the type of the message (`"inform"`, `"error"`, `"success"`) |

Example for custom notification:

```lua
AddEventHandler('yaca:external:notification', function (message, type)
  -- Call your Notifications System here.
end)
```

### yaca:external:channelChanged

The event is triggered when the player changes the channel to the ingame or excluded channel.

| Parameter   | Type     | Description                                                                                                      |
|-------------|----------|------------------------------------------------------------------------------------------------------------------|
| channelType | `string` | `INGAME_CHANNEL` when moving into the ingame channel and `EXCLUDED_CHANNEL` when moving into a excluded channel. |

</details>

<details>
<summary style="font-size: x-large">Server</summary>

### yaca:external:changeMegaphoneState

The event is triggered when the megaphone state of a player changes.

| Parametr | Type      | Description             |
|----------|-----------|-------------------------|
| source   | `int`     | the player source       |
| state    | `boolean` | the new megaphone state |

### yaca:external:phoneCall

The event is triggered when a phone call is started or ended.

| Parameter | Type             | Description                                                                     |
|-----------|------------------|---------------------------------------------------------------------------------|
| source    | `int`            | the player source                                                               |
| target    | `int`            | the target player source                                                        |
| state     | `boolean`        | the new phone call state                                                        |
| filter    | `YacaFilterEnum` | the used filter for the phone call, can be either `PHONE` or `PHONE_HISTORICAL` |

### yaca:external:phoneSpeaker

The event is triggered when the phone speaker state of a player changes.

| Parameter | Type      | Description                 |
|-----------|-----------|-----------------------------|
| source    | `int`     | the player source           |
| state     | `boolean` | the new phone speaker state |

### yaca:external:changedRadioFrequency

The event is triggered when the radio frequency of a player changes.

| Parameter | Type     | Description                             |
|-----------|----------|-----------------------------------------|
| source    | `int`    | the player source                       |
| channel   | `int`    | the channel where the frequency was set |
| frequency | `string` | the frequency to set                    |

### yaca:external:changedRadioMuteState

The event is triggered when the radio mute state of a player changes.

| Parameter | Type      | Description                                  |
|-----------|-----------|----------------------------------------------|
| source    | `int`     | the player source                            |
| channel   | `int`     | the channel where the mute state was changed |
| state     | `boolean` | the new mute state                           |

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
