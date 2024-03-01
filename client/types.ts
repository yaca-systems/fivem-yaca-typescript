import {
  CommDeviceMode,
  type YacaFilterEnum,
  YacaStereoMode,
} from "#client/enums";

interface YacaResponse {
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

interface YacaLocalPlugin {
  canChangeVoiceRange: boolean;
  maxVoiceRange: number;
  lastMegaphoneState: boolean;
  canUseMegaphone: boolean;
}

interface YacaPlayerData {
  remoteID?: number;
  clientId?: number;
  forceMuted?: boolean;
  mutedOnPhone?: boolean;
  range?: number;
  isTalking?: boolean;
  phoneCallMemberIds?: number[];
}

interface DataObject {
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
}

interface YacaClient {
  client_id?: number;
  mode?: CommDeviceMode;
}
interface YacaProtocol {
  comm_type: YacaFilterEnum;
  output_mode?: YacaStereoMode;
  members?: YacaClient[];
  on?: boolean;
  volume?: number;
  channel?: number;
  range?: number;
}

interface YacaRadioSettings {
  frequency: string;
  muted: boolean;
  volume: number;
  stereo: YacaStereoMode;
}

export {
  YacaResponse,
  YacaLocalPlugin,
  YacaPlayerData,
  DataObject,
  YacaProtocol,
  YacaClient,
  YacaRadioSettings,
};
