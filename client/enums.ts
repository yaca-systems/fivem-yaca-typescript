enum YacaFilterEnum {
  RADIO = "RADIO",
  "MEGAPHONE" = "MEGAPHONE",
  "PHONE" = "PHONE",
  "PHONE_SPEAKER" = "PHONE_SPEAKER",
  "INTERCOM" = "INTERCOM",
  "PHONE_HISTORICAL" = "PHONE_HISTORICAL",
}

enum YacaSteroMode {
  MONO_LEFT = "MONO_LEFT",
  MONO_RIGHT = "MONO_RIGHT",
  STEREO = "STEREO",
}

enum YacaBuildType {
  RELEASE = 0,
  DEVELOP = 1,
}

enum CommDeviceMode {
  SENDER = 0,
  RECEIVER = 1,
  TRANSCEIVER = 2,
}

export { YacaFilterEnum, YacaSteroMode, YacaBuildType, CommDeviceMode };
