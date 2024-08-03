const localLipSyncAnimations: Record<"fivem" | "redm", Record<string, { name: string; dict: string }>> = {
  fivem: {
    true: {
      name: "mic_chatter",
      dict: "mp_facial",
    },
    false: {
      name: "mood_normal_1",
      dict: "facials@gen_male@variations@normal",
    },
  },
  redm: {
    true: {
      name: "mood_talking_normal",
      dict: "face_human@gen_male@base",
    },
    false: {
      name: "mood_normal",
      dict: "face_human@gen_male@base",
    },
  },
};

const REDM_KEY_TO_HASH: Record<string, number | null> = {
  // Letters
  A: 0x7065027d,
  B: 0x4cc0e2fe,
  C: 0x9959a6f0,
  D: 0xb4e465b4,
  E: 0xcefd9220,
  F: 0xb2f377e8,
  G: 0x760a9c6f,
  H: 0x24978a28,
  I: 0xc1989f95,
  J: 0xf3830d8e,
  K: null,
  L: 0x80f28e95,
  M: 0xe31c6a41,
  N: 0x4bc9dabb, // (Push to Talk)
  O: 0xf1301666,
  P: 0xd82e0bd2,
  Q: 0xde794e3e,
  R: 0xe30cd707,
  S: 0xd27782e3,
  T: null,
  U: 0xd8f73058,
  V: 0x7f8d09b8,
  W: 0x8fd015d8,
  X: 0x8cc9cd42,
  Y: null,
  Z: 0x26e9dc00,

  // Symbol Keys
  RIGHTBRACKET: 0xa5bdcd3c,
  LEFTBRACKET: 0x430593aa,

  // Mouse buttons
  MOUSE1: 0x07ce1e61,
  MOUSE2: 0xf84fa74f,
  MOUSE3: 0xcee12b50,
  MWUP: 0x3076e97c,

  // Modifier Keys
  CTRL: 0xdb096b85,
  TAB: 0xb238fe0b,
  SHIFT: 0x8ffc75d6,
  SPACEBAR: 0xd9d0e1c0,
  ENTER: 0xc7b5340a,
  BACKSPACE: 0x156f7119,
  LALT: 0x8aaa0ad4,
  DEL: 0x4af4d473,
  PGUP: 0x446258b6,
  PGDN: 0x3c3dd371,

  // Function Keys
  F1: 0xa8e3f467,
  F4: 0x1f6d95e5,
  F6: 0x3c0a40f2,

  // Number Keys
  "1": 0xe6f612e4,
  "2": 0x1ce6d9eb,
  "3": 0x4f49cc4c,
  "4": 0x8f9f9e58,
  "5": 0xab62e997,
  "6": 0xa1fde2a6,
  "7": 0xb03a913b,
  "8": 0x42385422,

  // Arrow Keys
  DOWN: 0x05ca7c52,
  UP: 0x6319db71,
  LEFT: 0xa65ebab4,
  RIGHT: 0xdeb34313,
};

export { localLipSyncAnimations, REDM_KEY_TO_HASH };
