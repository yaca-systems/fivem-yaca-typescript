export enum YacaFilterEnum {
    RADIO = 'RADIO',
    MEGAPHONE = 'MEGAPHONE',
    PHONE = 'PHONE',
    /**
     * @deprecated The plugin marks this filter as deprecated, but it is still fully functional and has its own
     * communication device. Do not migrate to {@link YacaFilterEnum.PHONE} until the speaker stage landed in the plugin.
     */
    PHONE_SPEAKER = 'PHONE_SPEAKER',
    INTERCOM = 'INTERCOM',
    PHONE_HISTORICAL = 'PHONE_HISTORICAL',
}

/**
 * Effects without a communication device behind them.
 *
 * These are only valid inside the `disabled_filters` list of the init request and must never be used as the
 * `comm_type` of a communication device, as they would create a device without any channel or member semantics.
 */
export enum YacaEffectFilterEnum {
    MUFFLE = 'MUFFLE',
    WATER = 'WATER',
    ECHO = 'ECHO',
    REVERB = 'REVERB',
}

/**
 * A filter that can be disabled via the `disabledFilters` shared config option.
 */
export type YacaDisableableFilter = YacaFilterEnum | YacaEffectFilterEnum

export enum YacaNotificationType {
    ERROR = 'error',
    INFO = 'inform',
    SUCCESS = 'success',
}

export enum YacaStereoMode {
    MONO_LEFT = 'MONO_LEFT',
    MONO_RIGHT = 'MONO_RIGHT',
    STEREO = 'STEREO',
}

export enum YacaBuildType {
    RELEASE = 0,
    DEVELOP = 1,
}

export enum CommDeviceMode {
    SENDER = 0,
    RECEIVER = 1,
    TRANSCEIVER = 2,
}

export enum YacaPluginStates {
    NOT_CONNECTED = 'NOT_CONNECTED',
    CONNECTED = 'CONNECTED',
    OUTDATED_VERSION = 'OUTDATED_VERSION',
    WRONG_TS_SERVER = 'WRONG_TS_SERVER',
    IN_INGAME_CHANNEL = 'IN_INGAME_CHANNEL',
    IN_EXCLUDED_CHANNEL = 'IN_EXCLUDED_CHANNEL',
}
