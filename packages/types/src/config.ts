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
        increaseVoicerange: string | false
        decreaseVoicerange: string | false
        primaryRadioTransmit: string | false
        secondaryRadioTransmit: string | false
        megaphone: string | false
        voicerrangeScroll: number | false
    }
    radioSettings: {
        channelCount: number
        mode: 'None' | 'Direct' | 'Tower'
        maxDistance: number
        towerPositions: [number, number, number][]
    }
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
    saltyChatBridge: boolean

    mufflingSettings: {
        mufflingRange: number
        vehicleMuffling: {
            enabled: boolean
            vehicleWhitelist: string[]
        }
        intensities: {
            differentRoom: number
            bothCarsClosed: number
            oneCarClosed: number
            megaPhoneInCar: number
        }
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
        increaseVoicerange: 'ADD',
        decreaseVoicerange: 'SUBTRACT',
        primaryRadioTransmit: 'N',
        secondaryRadioTransmit: 'CAPITAL',
        megaphone: 'B',
        voicerrangeScroll: false,
    },
    radioSettings: {
        channelCount: 9,
        mode: 'None',
        maxDistance: 1000,
        towerPositions: [
            [2572, 5397, 56],
            [2663, 4972, 56],
            [2892, 3911, 56],
            [2720, 3304, 64],
            [2388, 2949, 64],
            [1830, 2368, 64],
            [1650, 1316, 102],
            [1363, 680, 102],
            [918, 230, 92],
            [567, 303, 58],
            [-47, -666, 74],
            [-585, -902, 53],
            [2572, 5397, 56],
            [2338, 5940, 77],
            [1916, 6244, 65],
            [1591, 6371, 42],
            [953, 6504, 42],
            [76, 6606, 42],
            [408, 6587, 42],
            [-338, -579, 48],
            [-293, -632, 47],
            [-269, -962, 143],
            [98, -870, 136],
            [-214, -744, 219],
            [-166, -590, 199],
            [124, -654, 261],
            [149, -769, 261],
            [580, 89, 117],
            [423, 15, 151],
            [424, 18, 151],
            [551, -28, 93],
            [305, -284, 68],
            [299, -313, 68],
            [1240, -1090, 44],
            [-418, -2804, 14],
            [802, -2996, 27],
            [253, -3145, 39],
            [207, -3145, 39],
            [207, -3307, 39],
            [247, -3307, 39],
            [484, -2178, 40],
            [548, -2219, 67],
            [-701, 58, 68],
            [-696, 208, 139],
            [-769, 255, 134],
            [-150, -150, 96],
            [-202, -327, 65],
            [-1913, -3031, 22],
            [-1918, -3028, 22],
            [-1039, -2385, 27],
            [-1042, -2390, 27],
            [-1583, -3216, 28],
            [-1590, -3212, 28],
            [-1308, -2626, 36],
            [-1311, -2624, 36],
            [-984, -2778, 48],
            [-991, -2774, 48],
            [-556, -119, 50],
            [-619, -106, 51],
            [-1167, -575, 40],
            [-1152, -443, 42],
            [-1156, -498, 49],
            [-1290, -445, 106],
            [-928, -383, 135],
            [-902, -443, 170],
            [-770, -786, 83],
            [-824, -719, 120],
            [-598, -917, 35],
            [-678, -717, 54],
            [-669, -804, 31],
            [-1463, -526, 83],
            [-1525, -596, 66],
            [-1375, -465, 83],
            [-1711, 478, 127],
            [-2311, 335, 187],
            [-2214, 342, 198],
            [-2234, 187, 193],
            [202, 1204, 230],
            [217, 1140, 230],
            [668, 590, 136],
            [722, 562, 134],
            [838, 510, 138],
            [773, 575, 138],
            [735, 231, 145],
            [450, 5566, 795],
            [-449, 6019, 35],
            [-142, 6286, 39],
            [-368, 6105, 38],
            [2792, 5996, 355],
            [2796, 5992, 354],
            [3460, 3653, 51],
            [3459, 3659, 51],
            [3615, 3642, 51],
            [3614, 3636, 51],
            [-2180, 3252, 54],
            [-2124, 3219, 54],
            [-2050, 3178, 54],
            [1858, 3694, 37],
            [1695, 3614, 37],
            [1692, 2532, 60],
            [1692, 2647, 60],
            [1824, 2574, 60],
            [1407, 2117, 104],
        ],
    },
    voiceRange: {
        defaultIndex: 1,
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
    saltyChatBridge: false,
    mufflingSettings: {
        mufflingRange: -1,
        vehicleMuffling: {
            enabled: true,
            vehicleWhitelist: [
                'gauntlet6',
                'draugur',
                'bodhi2',
                'vagrant',
                'outlaw',
                'trophytruck',
                'ratel',
                'drifttampa',
                'sm722',
                'tornado4',
                'swinger',
                'locust',
            ],
        },
        intensities: {
            differentRoom: 10,
            bothCarsClosed: 10,
            oneCarClosed: 6,
            megaPhoneInCar: 6,
        },
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
