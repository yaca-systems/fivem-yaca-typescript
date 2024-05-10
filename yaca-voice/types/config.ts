import { YacaBuildType } from "./enums";

export interface YacaSharedConfig {
  debug: boolean;
  versionCheck: boolean;
  buildType: YacaBuildType;
  locale: string;
  unmuteDelay: number;
  maxPhoneSpeakerRange: number;
  notifications: {
    oxLib: boolean;
    gta: boolean;
    redm: boolean;
    own: boolean;
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
    sendNotification: boolean;
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
    automaticVehicleDetection: boolean;
    allowedVehicleClasses: number[];
  };
  saltyChatBridge: {
    enabled: boolean;
    keyBinds: {
      primaryRadio: string | false;
      secondaryRadio: string | false;
    };
  };
  vehicleMuffling: boolean;
  mufflingRange: number;
  mufflingVehicleWhitelist: string[];
  mufflingIntensities: {
    differentRoom: number;
    bothCarsClosed: number;
    oneCarClosed: number;
    megaPhoneInCar: number;
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
