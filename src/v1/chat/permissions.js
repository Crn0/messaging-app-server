const CHAT_LIMITS = {
  maxDirectChats: 20,
  maxGroupChats: 20,
  roleLimits: 5,
};

const PERMISSIONS = {
  chat: {
    update: {
      profile: ["manage_chat", "admin"],
      settings: ["admin"],
    },
  },
  member: {
    update: {
      mute: ["admin", "mute_member"],
      unMute: ["admin", "mute_member"],
    },
    destroy: ["admin", "kick_member"],
  },
  role: {
    create: ["admin", "manage_role"],
    view: ["admin", "manage_role"],
    update: ["admin", "manage_role"],
  },
  message: {
    create: ["admin", "send_message", "manage_message"],
    destroy: ["admin", "manage_message"],
  },
};

const FLAT_PERMISSIONS = [
  "admin",
  "manage_chat",
  "manage_role",
  "manage_message",
  "kick_member",
  "mute_member",
  "send_message",
];

export { PERMISSIONS, FLAT_PERMISSIONS, CHAT_LIMITS };
