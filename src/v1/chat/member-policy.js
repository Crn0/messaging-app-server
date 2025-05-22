import { PERMISSIONS } from "./permissions.js";
import {
  executePermissionCheck,
  getHighestRoleLevel,
  getRolesWithRequiredPermissions,
} from "./utils.js";

export default {
  create: {
    self: (user, chat) => {
      const { isPrivate } = chat;
      const isMember = chat.members.includes(user.id);

      if (isMember) {
        return {
          allowed: false,
          code: "conflict",
          reason: "Chat membership already exist",
        };
      }

      if (isPrivate)
        return {
          allowed: false,
          code: "not_found",
          reason: "Chat not found",
        };

      return {
        allowed: true,
        code: "ok",
        reason: "Membership permission granted",
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
        reason: isPrivate ? "Chat not found" : "View permission denied",
      };
    }

    return { allowed: true, code: "ok", reason: "View permission granted" };
  },
  update: {
    "mutedUntil:mute": (user, chat, { targetUser }) => {
      const isUserMember = chat.members.includes(user.id);
      const isUserOwner = chat.ownerId === user.id;
      const isTargetOwner = chat.ownerId === targetUser.id;

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to mute others",
        };
      }

      if (isTargetOwner) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot mute the chat owner",
        };
      }

      const targetIsAdmin = targetUser.roles.some((role) =>
        role.permissions.some((p) => p.name === "admin")
      );

      if (targetIsAdmin) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot mute an admin member",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can mute any member",
        };
      }

      const userLevel = getHighestRoleLevel(user);
      const targetLevel = getHighestRoleLevel(targetUser);

      const userIsHigherRank = userLevel < targetLevel;
      const userIsLowerRank = userLevel > targetLevel;

      if (userIsLowerRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot mute a member with higher role level",
        };
      }

      if (userIsHigherRank) {
        return {
          allowed: true,
          code: "ok",
          reason: "User has higher rank; mute allowed",
        };
      }

      const requiredPermissions = PERMISSIONS.member.update.mute;

      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestFilterRoleLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

      const hasPermission = executePermissionCheck(
        { roles: filteredRoles },
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

      const highestFilterRoleLevelIsLowerOrEqualRank =
        highestFilterRoleLevel >= targetLevel;

      if (highestFilterRoleLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot mute a member with higher or equal role level",
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Permission granted to mute member",
      };
    },
    "mutedUntil:unmute": (user, chat, { targetUser }) => {
      const isUserMember = chat.members.includes(user.id);
      const isUserOwner = chat.ownerId === user.id;

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to unmute others",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can unmute any member",
        };
      }

      const userLevel = getHighestRoleLevel(user);
      const targetLevel = getHighestRoleLevel(targetUser);

      const userIsHigherRank = userLevel < targetLevel;
      const userIsLowerRank = userLevel > targetLevel;

      if (userIsLowerRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot unmute a member with higher role level",
        };
      }

      if (userIsHigherRank) {
        return {
          allowed: true,
          code: "ok",
          reason: "User outranks target; unmute allowed",
        };
      }

      const requiredPermissions = PERMISSIONS.member.update.unMute;

      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestFilterRoleLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

      const hasPermission = executePermissionCheck(
        { roles: filteredRoles },
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

      const highestFilterRoleLevelIsLowerOrEqualRank =
        highestFilterRoleLevel >= targetLevel;

      if (highestFilterRoleLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot unmute a member with higher or equal role level",
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Permission granted to unmute member",
      };
    },
  },
  delete: {
    self: (user, chat) => {
      const userIsOwner = chat.ownerId === user.id;

      if (userIsOwner) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "Must transfer chat ownership before you can leave",
        };
      }

      const isUserAMember = chat.members.includes(user.id);

      if (!isUserAMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "Must be member to leave chat",
        };
      }

      return {
        allowed: true,
        code: "ok",
        message: "Member can leave chat",
      };
    },
    kick: (user, chat, { targetUser }) => {
      const isUserMember = chat.members.includes(user.id);

      const isTargetOwner = chat.ownerId === targetUser.id;
      const isUserOwner = chat.ownerId === user.id;

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to kick others",
        };
      }

      if (isTargetOwner) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot kick the chat owner",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can kick any member",
        };
      }

      const userRoleLevel = getHighestRoleLevel(user);
      const targetRoleLevel = getHighestRoleLevel(targetUser);

      const isTargetHigherOrEqual = targetRoleLevel <= userRoleLevel;

      if (isTargetHigherOrEqual) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot kick a member with higher or equal role level",
        };
      }

      const requiredPermissions = PERMISSIONS.member.destroy;
      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestFilterRoleLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

      const hasPermission = executePermissionCheck(
        { roles: filteredRoles },
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

      const highestFilterRoleLevelIsLowerOrEqualRank =
        highestFilterRoleLevel >= targetRoleLevel;

      if (highestFilterRoleLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot kick a member with higher or equal role level",
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Permission granted to kick member",
      };
    },
  },
};
