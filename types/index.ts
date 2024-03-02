/* EMUMS */

export enum YacaFilterEnum {
  RADIO = "RADIO",
  "MEGAPHONE" = "MEGAPHONE",
  "PHONE" = "PHONE",
  "PHONE_SPEAKER" = "PHONE_SPEAKER",
  "INTERCOM" = "INTERCOM",
  "PHONE_HISTORICAL" = "PHONE_HISTORICAL",
}

export enum YacaStereoMode {
  MONO_LEFT = "MONO_LEFT",
  MONO_RIGHT = "MONO_RIGHT",
  STEREO = "STEREO",
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

/* TYPES */
export interface YacaResponse {
  code:
    | "RENAME_CLIENT"
    | "MOVE_CLIENT"
    | "MUTE_STATE"
    | "TALK_STATE"
    | "OK"
    | "WRONG_TS_SERVER"
    | "NOT_CONNECTED"
    | "MOVE_ERROR"
    | "OUTDATED_VERSION"
    | "WAIT_GAME_INIT"
    | "HEARTBEAT";
  requestType: string;
  message: string;
}

export interface YacaLocalPlugin {
  canChangeVoiceRange: boolean;
  maxVoiceRange: number;
  lastMegaphoneState: boolean;
  canUseMegaphone: boolean;
}

export interface YacaPlayerData {
  remoteID?: number;
  clientId?: number;
  forceMuted?: boolean;
  mutedOnPhone?: boolean;
  range?: number;
  isTalking?: boolean;
  phoneCallMemberIds?: number[];
}

export interface DataObject {
  range?: number;
  clientId?: number;
  playerId?: number;
  forceMuted?: boolean;
  mutedOnPhone?: boolean;
  suid?: string;
  chid?: number;
  deChid?: number;
  channelPassword?: string;
  ingameName?: string;
  useWhisper?: boolean;
  excludeChannels?: number[];
}

export interface YacaClient {
  client_id?: number;
  mode?: CommDeviceMode;
}
export interface YacaProtocol {
  comm_type: YacaFilterEnum;
  output_mode?: YacaStereoMode;
  members?: YacaClient[];
  on?: boolean;
  volume?: number;
  channel?: number;
  range?: number;
}

export interface YacaRadioSettings {
  frequency: string;
  muted: boolean;
  volume: number;
  stereo: YacaStereoMode;
}

export interface YacaSharedConfig {
  debug: boolean;
  maxRadioChannels: number;
  mufflingRange: number;
  unmuteDelay: number;
  maxPhoneSpeakerRange: number;
  defaultRadioChannelSettings: YacaRadioSettings;
  defaultVoiceRangeIndex: number;
  voiceRanges: number[];
  megaphoneAllowedVehicleClasses: number[];
}

export interface YacaServerConfig {
  uniqueServerId: string;
  ingameChannelId: number;
  ingameChannelPassword: string;
  defaultChannelId: number;
  useWhisper: boolean;
  excludeChannels: number[];
  megaPhoneRange: number;
}
