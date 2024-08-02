import { CommDeviceMode, YacaFilterEnum, YacaStereoMode } from "./enums";

export type YacaResponseCode =
  | "SOUND_STATE"
  | "MUTE_STATE" // Deprecated in favor of SOUND_STATE
  | "TALK_STATE"
  | "OK"
  | "WRONG_TS_SERVER"
  | "MOVE_ERROR"
  | "OUTDATED_VERSION"
  | "WAIT_GAME_INIT"
  | "HEARTBEAT"
  | "MAX_PLAYER_COUNT_REACHED"
  | "LICENSE_SERVER_TIMED_OUT"
  | "MOVED_CHANNEL"
  | "OTHER_TALK_STATE";

export interface YacaResponse {
  code: YacaResponseCode;
  requestType: string;
  message: string;
}

export interface YacaSoundStateMessage {
  microphoneMuted: boolean;
  microphoneDisabled: boolean;
  soundMuted: boolean;
  soundDisabled: boolean;
}

export interface YacaPlayerData {
  remoteID?: number;
  clientId?: number;
  forceMuted?: boolean;
  mutedOnPhone?: boolean;
  phoneCallMemberIds?: number[];
}

export interface DataObject {
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

export type ClientCache = {
  serverId: number;
  playerId: number;
  resource: string;
  ped: number;
  vehicle: number | false;
  seat: number | false;
  game: "fivem" | "redm";
};

export type ServerCache = {
  resource: string;
};

export type YacaPluginPlayerData = {
  client_id: number;
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  range: number;
  is_underwater: boolean;
  muffle_intensity: number;
  is_muted: boolean;
};
