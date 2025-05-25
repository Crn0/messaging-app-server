import { PERMISSIONS } from "./permissions.js";
import {
  executePermissionCheck,
  getHighestRoleLevel,
  getRolesWithRequiredPermissions,
} from "./utils.js";

export default {
  create: {
    direct: (user, chat, { targetUser }) => {
      const isUserMember = chat.members.includes(user.id);

      if (!isUserMember) {
        return {
          allowed: false,
          code: "not_found",
          reason: "Chat not found",
        };
      }

      const isUserBlocked = targetUser.blockedUsers.some(
        (u) => u.id === user.id
      );
      const isTargetUserBlocked = user.blockedUsers.some(
        (u) => u.id === targetUser.id
      );

      if (isUserBlocked || isTargetUserBlocked) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "Either user has blocked the other",
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Create permission granted",
      };
    },
    group: (user, chat) => {
      const isUserOwner = chat.ownerId === user.id;

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can send messages",
        };
      }

      const isUserMember = chat.members.includes(user.id);

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to send messages",
        };
      }

      const requiredPermissions = PERMISSIONS.message.create;

      const isAdmin = user.roles
        .flatMap((r) => r.permissions)
        .some((p) => p.name === "admin");

      if (isAdmin) {
        return {
          allowed: true,
          code: "ok",
          reason: "Admin permission granted",
        };
      }

      const { mutedUntil } = user.serverProfile;

      const isMuted = mutedUntil && Date.now() < new Date(mutedUntil).getTime();

      if (isMuted) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot perform this action while muted",
        };
      }

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
        reason: "Create permission granted",
      };
    },
  },
  view: (user, chat) => {
    if (user.id === chat.ownerId)
      return { allowed: true, code: "ok", reason: "View permission granted" };

    const { isPrivate } = chat;
    const isMember = chat.members.includes(user.id);

    if (!isMember) {
      return {
        allowed: false,
        code: isPrivate ? "not_found" : "forbidden",
        reason: isPrivate
          ? "Chat not found"
          : "You must be a chat member to view chat messages",
      };
    }

    return { allowed: true, code: "ok", reason: "View permission granted" };
  },
  delete: (user, chat, { targetMessage }) => {
    if (user.id === chat.ownerId) {
      return { allowed: true, code: "ok", reason: "Delete permission granted" };
    }

    if (user.id === targetMessage.user.id) {
      return { allowed: true, code: "ok", reason: "Delete permission granted" };
    }

    const { isPrivate } = chat;
    const isMember = chat.members.includes(user.id);

    if (!isMember) {
      return {
        allowed: false,
        code: isPrivate ? "not_found" : "forbidden",
        reason: isPrivate
          ? "Chat not found"
          : "You must be a chat member to delete messages",
      };
    }

    const isAdmin = user.roles
      .flatMap((r) => r.permissions)
      .some((p) => p.name === "admin");

    if (isAdmin) {
      return {
        allowed: true,
        code: "ok",
        reason: "Admin permission granted",
      };
    }

    const requiredPermissions = PERMISSIONS.message.destroy;

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
      reason: "Delete permission granted",
    };
  },
};
