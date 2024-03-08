export interface YacaSharedConfig {
  debug: boolean;
  locale: string;
  mufflingRange: number;
  unmuteDelay: number;
  maxPhoneSpeakerRange: number;
  notifications: {
    oxLib: boolean;
    gta: boolean;
  };
  keyBinds: {
    toggleRange: string;
    radioTransmit: string;
    megaphone: string;
  };
  maxRadioChannels: number;
  shortRadioRange: number;
  voiceRange: {
    defaultIndex: number;
    ranges: number[];
  };
  megaphone: {
    range: number;
    allowedVehicleClasses: number[];
  }
  saltyChatBridge: {
    enabled: boolean;
    keyBinds: {
      primaryRadio: string;
      secondaryRadio: string;
    }
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