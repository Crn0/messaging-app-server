import POLICIES from "./permission-policies.js";
import { success, forbidden, notFound, conflict } from "./http-responce.js";
import { executePolicy } from "./utils.js";

const executePolicyCheck = executePolicy(POLICIES);

// ========================
// CHAT MANAGEMENT POLICIES
// ========================

const checkChatCreation = (user, chat, context) => {
  const { type } = context;

  const { allowed, code, reason } = executePolicyCheck(
    user,
    type === "DirectChat" ? context?.targetUser : chat,
    {
      context,
      resource: "chat",
      action: "create",
      field: type === "DirectChat" ? "direct" : "group",
    }
  );

  if (type === "DirectChat") {
    if (!allowed) {
      return code === "forbidden" ? forbidden(reason) : conflict(reason);
    }

    return success(reason);
  }

  if (type === "GroupChat") {
    if (!allowed) {
      return forbidden(reason);
    }

    return success(reason);
  }

  throw new Error(`Invalid type of chat: ${type}`);
};

const checkViewChatPermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "chat",
    action: "view",
    field: chat.type === "DirectChat" ? "direct" : "group",
  });

  if (!allowed) {
    return code === "not_found" ? notFound(reason) : forbidden(reason);
  }

  return success(reason);
};

const checkUpdateChatPermission = (user, chat, { field }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    field,
    resource: "chat",
    action: "update",
    context: { field },
  });

  if (!allowed) {
    return code === "forbidden" ? forbidden(reason) : notFound(reason);
  }

  return success(reason);
};

const checkDeleteChatPermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "chat",
    action: "delete",
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

// ===========================
// MEMBERS MANAGEMENT POLICIES
// ===========================

const checkMemberJoinPermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "member",
    action: "create",
    field: "self",
  });

  if (!allowed) {
    return code === "conflict" ? conflict(reason) : notFound(reason);
  }

  return success(reason);
};

const checkMemberViewPermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "member",
    action: "view",
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkMuteMemberPermission = (user, chat, targetUser, fieldType) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "member",
    action: "update",
    field: fieldType === "unmute" ? "mutedUntil:unmute" : "mutedUntil:mute",
    context: { targetUser },
  });

  if (!allowed) {
    return code === "forbidden" ? forbidden(reason) : notFound(reason);
  }

  return success(reason);
};

const checkLeaveChatPermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "member",
    action: "delete",
    field: "self",
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkKickMemberPermission = (user, chat, targetUser) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "member",
    action: "delete",
    field: "kick",
    context: { targetUser },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

// =========================
// ROLES MANAGEMENT POLICIES
// =========================

const checkRoleCreatePermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "create",
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkRoleViewPermission = (user, chat, { targetUser }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "view",
    context: {
      targetUser,
    },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkRoleUpdateMetaDataPermission = (
  user,
  chat,
  { fields, targetRole }
) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "update",
    field: "metaData",
    context: { fields, targetRole },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkRoleUpdateMembersPermission = (user, chat, { targetRole }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "update",
    field: "member",
    context: { targetRole },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkRoleUpdateRolelevelsPermission = (user, chat, { targetRoles }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "update",
    field: "roleLevel",
    context: { targetRoles },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkDeleteRolePermission = (user, chat, { targetRole }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "role",
    action: "delete",
    context: { targetRole },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

// ============================
// MESSAGES MANAGEMENT POLICIES
// ============================

const checkSendMessagePermission = (user, chat, { targetUser }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "message",
    action: "create",
    field: chat.type === "DirectChat" ? "direct" : "group",
    context: { targetUser },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkCanViewMessagePermission = (user, chat) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "message",
    action: "view",
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

const checkCanDeleteMessagePermission = (user, chat, { targetMessage }) => {
  const { allowed, code, reason } = executePolicyCheck(user, chat, {
    resource: "message",
    action: "delete",
    context: { targetMessage },
  });

  if (!allowed)
    return code === "forbidden" ? forbidden(reason) : notFound(reason);

  return success(reason);
};

export default {
  chat: {
    checkCreate: checkChatCreation,
    checkView: checkViewChatPermission,
    checkUpdate: checkUpdateChatPermission,
    checkDelete: checkDeleteChatPermission,
  },

  member: {
    checkJoin: checkMemberJoinPermission,
    checkView: checkMemberViewPermission,
    checkMute: checkMuteMemberPermission,
    checkLeave: checkLeaveChatPermission,
    checkKick: checkKickMemberPermission,
  },
  role: {
    checkCreate: checkRoleCreatePermission,
    checkView: checkRoleViewPermission,
    checkUpdateMetaData: checkRoleUpdateMetaDataPermission,
    checkUpdateMembers: checkRoleUpdateMembersPermission,
    checkUpdateRoleLevels: checkRoleUpdateRolelevelsPermission,
    checkDelete: checkDeleteRolePermission,
  },
  message: {
    checkSend: checkSendMessagePermission,
    checkView: checkCanViewMessagePermission,
    checkDelete: checkCanDeleteMessagePermission,
  },
};
