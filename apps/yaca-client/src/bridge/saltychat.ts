import { saltyChatExport, sleep } from '@yaca-voice/common'
import { YacaPluginStates } from '@yaca-voice/types'
import { cache } from '../utils'
import type { YaCAClientModule } from '../yaca'

/**
 * The SaltyChat bridge for the client.
 */
export class YaCAClientSaltyChatBridge {
  private clientModule: YaCAClientModule

  private currentPluginState = -1

  private isPrimarySending = false
  private isSecondarySending = false

  private isPrimaryReceiving = false
  private isSecondaryReceiving = false

  /**
   * Creates an instance of the SaltyChat bridge.
   *
   * @param {YaCAClientModule} clientModule - The client module.
   */
  constructor(clientModule: YaCAClientModule) {
    this.clientModule = clientModule

    this.registerSaltyChatExports()
    this.enableRadio().then()

    console.log('[YaCA] SaltyChat bridge loaded')

    on('onResourceStop', (resourceName: string) => {
      if (cache.resource !== resourceName) {
        return
      }

      emit('onClientResourceStop', 'saltychat')
    })
  }

  /**
   * Enables the radio on bridge load.
   */
  async enableRadio() {
    while (!this.clientModule.isPluginInitialized(true)) {
      await sleep(1000)
    }

    this.clientModule.radioModule.enableRadio(true)
  }

  /**
   * Register SaltyChat exports.
   */
  registerSaltyChatExports() {
    saltyChatExport('GetVoiceRange', () => this.clientModule.getVoiceRange())

    saltyChatExport('GetRadioChannel', (primary: boolean) => {
      const channel = primary ? 1 : 2

      const currentFrequency = this.clientModule.radioModule.getRadioFrequency(channel)

      if (currentFrequency === '0') {
        return ''
      }

      return currentFrequency
    })

    saltyChatExport('GetRadioVolume', () => {
      return this.clientModule.radioModule.getRadioChannelVolume(1)
    })

    saltyChatExport('GetRadioSpeaker', () => {
      console.warn('GetRadioSpeaker is not implemented in YaCA')
      return false
    })

    saltyChatExport('GetMicClick', () => {
      console.warn('GetMicClick is not implemented in YaCA')
      return false
    })

    saltyChatExport('SetRadioChannel', (radioChannelName: string, primary: boolean) => {
      const channel = primary ? 1 : 2
      const newRadioChannelName = radioChannelName === '' ? '0' : radioChannelName

      this.clientModule.radioModule.changeRadioFrequencyRaw(newRadioChannelName, channel)
    })

    saltyChatExport('SetRadioVolume', (volume: number) => {
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(volume, 1)
      this.clientModule.radioModule.changeRadioChannelVolumeRaw(volume, 2)
    })

    saltyChatExport('SetRadioSpeaker', () => {
      console.warn('SetRadioSpeaker is not implemented in YaCA')
    })

    saltyChatExport('SetMicClick', () => {
      console.warn('SetMicClick is not implemented in YaCA')
    })

    saltyChatExport('GetPluginState', () => {
      return this.currentPluginState
    })
  }

  /**
   * Handles the plugin state change.
   *
   * @param response - The last response code.
   */
  handleChangePluginState(response: YacaPluginStates) {
    let state = 0

    switch (response) {
      case YacaPluginStates.IN_EXCLUDED_CHANNEL:
        state = 3
        break
      case YacaPluginStates.IN_INGAME_CHANNEL:
        state = 2
        break
      case YacaPluginStates.CONNECTED:
        state = 1
        break
      case YacaPluginStates.WRONG_TS_SERVER:
      case YacaPluginStates.OUTDATED_VERSION:
        state = 0
        break
      case YacaPluginStates.NOT_CONNECTED:
        state = -1
        break
      default:
        return
    }

    emit('SaltyChat_PluginStateChanged', state)
    this.currentPluginState = state
  }

  /**
   * Sends the radio talking state.
   */
  sendRadioTalkingState() {
    emit('SaltyChat_RadioTrafficStateChanged', this.isPrimaryReceiving, this.isPrimarySending, this.isSecondaryReceiving, this.isSecondarySending)
  }

  /**
   * Handle radio talking state change.
   *
   * @param state - The state of the radio talking.
   * @param channel - The radio channel.
   */
  handleRadioTalkingStateChange(state: boolean, channel: number) {
    if (channel === 1) {
      this.isPrimarySending = state
    } else {
      this.isSecondarySending = state
    }

    this.sendRadioTalkingState()
  }

  /**
   * Handle radio receiving state change.
   *
   * @param state - The state of the radio receiving.
   * @param channel - The radio channel.
   */
  handleRadioReceivingStateChange(state: boolean, channel: number) {
    if (channel === 1) {
      this.isPrimaryReceiving = state
    } else {
      this.isSecondaryReceiving = state
    }

    this.sendRadioTalkingState()
  }
}
