import { PERMISSIONS, CHAT_LIMITS } from "./permissions.js";
import { executePermissionCheck } from "./utils.js";

export default {
  create: {
    direct: (user, targetUser) => {
      const directCount =
        user.chats?.filter((chat) => chat.type === "DirectChat").length || 0;

      const maxDirectChatsLimitReached =
        directCount >= CHAT_LIMITS.maxDirectChats;

      if (maxDirectChatsLimitReached) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `Maximum ${CHAT_LIMITS.maxDirectChats} direct chats allowed`,
        };
      }

      const userBlockedTargetUser = user.blockedUsers.some(
        (blockedUser) => blockedUser.id === targetUser.id
      );

      const targetUserBlockedUser = user.blockedUsers.some(
        (blockedUser) => blockedUser.id === user.id
      );

      if (userBlockedTargetUser || targetUserBlockedUser) {
        return {
          allow: false,
          code: "forbidden",
          reason:
            "Action not allowed because one of the users has blocked the other",
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Create permission granted",
      };
    },
    group: (user) => {
      const groupCount =
        user.chats?.filter((chat) => chat.type === "GroupChat").length || 0;

      const maxGroupChatsLimitReached = groupCount >= CHAT_LIMITS.maxGroupChats;

      if (maxGroupChatsLimitReached) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `Maximum ${CHAT_LIMITS.maxGroupChats} group chats allowed`,
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Create permission granted",
      };
    },
  },

  view: {
    direct: (user, chat) => {
      const isMember = chat.members.includes(user.id);

      if (!isMember) {
        return {
          allowed: false,
          code: "not_found",
          reason: "Chat not found",
        };
      }

      return { allowed: true, code: "ok", reason: "View permission granted" };
    },
    group: (user, chat) => {
      if (user.id === chat.ownerId)
        return { allowed: true, reason: "View permission granted" };

      const isMember = chat.members.includes(user.id);
      const { isPrivate } = chat;

      if (!isMember && isPrivate) {
        return {
          allowed: false,
          code: "not_found",
          reason: "Chat not found",
        };
      }

      if (!isMember) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "View permission denied",
        };
      }

      return { allowed: true, code: "ok", reason: "View permission granted" };
    },
  },

  update: (user, chat, { field }) => {
    if (user.id === chat?.ownerId)
      return {
        allowed: true,
        code: "ok",
        reason: "Update permission granted",
      };

    const { isPrivate } = chat;
    const isMember = chat.members.includes(user.id);
    const isGroupChat = chat.type === "GroupChat";

    if (isMember && !isGroupChat) {
      return {
        allowed: false,
        code: "forbidden",
        reason: "Direct chat cannot be modified",
      };
    }

    if (isPrivate && isGroupChat && !isMember) {
      return {
        allowed: false,
        code: "not_found",
        reason: "Chat not found",
      };
    }

    if (!isMember) {
      return {
        allowed: false,
        code: "forbidden",
        reason: `You must be a chat member to modify ${field}`,
      };
    }

    const requiredPermissions = PERMISSIONS.chat.update.name;

    const hasPermission = executePermissionCheck(
      user,
      chat,
      requiredPermissions
    );

    if (!hasPermission) {
      return {
        allowed: false,
        code: "forbidden",
        reason: `Missing permission: ${requiredPermissions.join(" or ")}`,
      };
    }

    return {
      allowed: true,
      code: "ok",
      reason: "Update permission granted",
    };
  },
  delete: (user, chat) => {
    const isOwner = user.id === chat.ownerId;
    const isMember = chat.members.includes(user.id);
    const isGroupChat = chat.type === "GroupChat";
    const isPrivateChat = chat.isPrivate;

    const isDirectChatMember = isMember && !isGroupChat;
    const isInvisiblePrivateChat = isPrivateChat && !isMember;

    if (isDirectChatMember) {
      return {
        allowed: false,
        code: "forbidden",
        reason: "Direct chat cannot be deleted",
      };
    }

    if (isInvisiblePrivateChat) {
      return {
        allowed: false,
        code: "not_found",
        reason: "Chat not found",
      };
    }

    if (!isOwner) {
      return {
        allowed: false,
        code: "forbidden",
        reason: "Must be owner to delete chat",
      };
    }

    return {
      allowed: true,
      code: "OK",
      reason: "Delete permission granted",
    };
  },
};
