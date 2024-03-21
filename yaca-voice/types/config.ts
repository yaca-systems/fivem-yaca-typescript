import { YacaBuildType } from "./enums";

export interface YacaSharedConfig {
  debug: boolean;
  buildType: YacaBuildType;
  locale: string;
  unmuteDelay: number;
  maxPhoneSpeakerRange: number;
  notifications: {
    oxLib: boolean;
    gta: boolean;
  };
  keyBinds: {
    toggleRange: string | false;
    radioTransmit: string | false;
    megaphone: string | false;
  };
  maxRadioChannels: number;
  shortRadioRange: number;
  voiceRange: {
    defaultIndex: number;
    ranges: number[];
    markerColor: {
      enabled: boolean;
      r: number;
      g: number;
      b: number;
      a: number;
      duration: number;
    };
  };
  megaphone: {
    range: number;
    allowedVehicleClasses: number[];
  };
  saltyChatBridge: {
    enabled: boolean;
    keyBinds: {
      primaryRadio: string;
      secondaryRadio: string;
    };
  };
  vehicleMuffling: boolean;
  mufflingRange: number;
  mufflingIntensities: {
    differentRoom: number;
    bothCarsClosed: number;
    oneCarClosed: number;
  };
}

export interface YacaServerConfig {
  uniqueServerId: string;
  ingameChannelId: number;
  ingameChannelPassword: string;
  defaultChannelId: number;
  useWhisper: boolean;
  excludeChannels: number[];
}
