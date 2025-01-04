import { YacaBuildType } from './enums'

export interface YacaSharedConfig {
  debug: boolean
  versionCheck: boolean
  buildType: YacaBuildType
  locale: string
  unmuteDelay: number
  maxPhoneSpeakerRange: number
  phoneHearPlayersNearby: false | 'PHONE_SPEAKER' | true
  notifications: {
    oxLib: boolean
    okoknotify: boolean
    gta: boolean
    redm: boolean
    own: boolean
  }
  keyBinds: {
    toggleRange: string | false
    radioTransmit: string | false
    megaphone: string | false
  }
  maxRadioChannels: number
  voiceRange: {
    defaultIndex: number
    ranges: number[]
    sendNotification: boolean
    markerColor: {
      enabled: boolean
      r: number
      g: number
      b: number
      a: number
      duration: number
    }
  }
  megaphone: {
    range: number
    automaticVehicleDetection: boolean
    allowedVehicleClasses: number[]
    allowedVehicleModels: string[]
  }
  saltyChatBridge: {
    enabled: boolean
    keyBinds: {
      primaryRadio: string | false
      secondaryRadio: string | false
    }
  }
  vehicleMuffling: boolean
  mufflingRange: number
  mufflingVehicleWhitelist: string[]
  mufflingIntensities: {
    differentRoom: number
    bothCarsClosed: number
    oneCarClosed: number
    megaPhoneInCar: number
  }
  radioAntiSpamCooldown: number | false
  useLocalLipSync: boolean
}

export const defaultSharedConfig: YacaSharedConfig = {
  debug: false,
  versionCheck: true,
  buildType: YacaBuildType.RELEASE,
  locale: 'en',
  unmuteDelay: 400,
  maxPhoneSpeakerRange: 5,
  phoneHearPlayersNearby: false,
  notifications: {
    oxLib: false,
    okoknotify: false,
    gta: true,
    redm: false,
    own: false,
  },
  keyBinds: {
    toggleRange: 'Z',
    radioTransmit: 'CAPITAL',
    megaphone: 'B',
  },
  maxRadioChannels: 9,
  voiceRange: {
    defaultIndex: 2,
    ranges: [1, 3, 8, 15, 20, 25, 30, 40],
    sendNotification: true,
    markerColor: {
      enabled: true,
      r: 0,
      g: 255,
      b: 0,
      a: 50,
      duration: 1000,
    },
  },
  megaphone: {
    range: 30,
    automaticVehicleDetection: true,
    allowedVehicleClasses: [18, 19],
    allowedVehicleModels: ['polmav'],
  },
  saltyChatBridge: {
    enabled: false,
    keyBinds: {
      primaryRadio: 'N',
      secondaryRadio: 'CAPITAL',
    },
  },
  vehicleMuffling: true,
  mufflingRange: -1,
  mufflingVehicleWhitelist: ['gauntlet6', 'draugur', 'bodhi2', 'vagrant', 'outlaw', 'trophytruck', 'ratel', 'drifttampa', 'sm722', 'tornado4', 'swinger'],
  mufflingIntensities: {
    differentRoom: 10,
    bothCarsClosed: 10,
    oneCarClosed: 6,
    megaPhoneInCar: 6,
  },
  radioAntiSpamCooldown: false,
  useLocalLipSync: false,
}

export interface YacaServerConfig {
  uniqueServerId: string
  ingameChannelId: number
  ingameChannelPassword: string
  defaultChannelId: number
  useWhisper: boolean
  excludeChannels: number[]
  userNamePattern: string
}

export const defaultServerConfig: YacaServerConfig = {
  uniqueServerId: '',
  ingameChannelId: 3,
  ingameChannelPassword: '',
  defaultChannelId: 1,
  useWhisper: false,
  excludeChannels: [],
  userNamePattern: '[{serverid}] {guid}',
}
