import { type CommDeviceMode, YacaFilterEnum, YacaStereoMode } from "types";

export type YacaResponseCode =
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

export interface YacaResponse {
  code: YacaResponseCode;
  requestType: string;
  message: string;
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

export type ClientCache = {
  serverId: number;
  playerId: number;
  resource: string;
  ped: number;
  vehicle: number | false;
  seat: number | false;
};

export type ServerCache = {
  resource: string;
};
