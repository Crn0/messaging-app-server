import { PERMISSIONS } from "./permissions.js";
import {
  executePermissionCheck,
  getHighestRoleLevel,
  getRolesWithRequiredPermissions,
} from "./utils.js";

export default {
  create: (user, chat) => {
    const isUserOwner = chat.ownerId === user.id;

    if (isUserOwner) {
      return {
        allowed: true,
        code: "ok",
        reason: "Chat owner can create roles",
      };
    }

    const isUserMember = chat.members.includes(user.id);

    if (!isUserMember) {
      return {
        allowed: false,
        code: chat.isPrivate ? "not_found" : "forbidden",
        reason: chat.isPrivate
          ? "Chat not found"
          : "You must be a chat member to create chat roles",
      };
    }

    const requiredPermissions = PERMISSIONS.role.create;

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
  view: (user, chat, { targetUser } = {}) => {
    const isUserOwner = chat.ownerId === user.id;

    if (isUserOwner) {
      return {
        allowed: true,
        code: "ok",
        reason: "Chat owner can view roles",
      };
    }

    const isUserMember = chat.members.includes(user.id);

    if (!isUserMember) {
      return {
        allowed: false,
        code: chat.isPrivate ? "not_found" : "forbidden",
        reason: chat.isPrivate
          ? "Chat not found"
          : "You must be a chat member to view chat roles",
      };
    }

    if (user.id === targetUser?.id) {
      return {
        allowed: true,
        code: "ok",
        reason: "View permission granted",
      };
    }

    const requiredPermissions = PERMISSIONS.role.view;

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
      reason: "View permission granted",
    };
  },
  update: {
    metaData: (user, chat, { fields, targetRole }) => {
      const isUserMember = chat.members.includes(user.id);
      const isUserOwner = chat.ownerId === user.id;
      const isUpdatingDefaultName =
        targetRole.isDefaultRole && fields.includes("name");

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to update roles",
        };
      }

      if (isUpdatingDefaultName) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You cannot update the name of a default role",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can update roles",
        };
      }

      const userLevel = getHighestRoleLevel(user);

      const userIsLowerOrEqualRank = userLevel >= targetRole?.roleLevel;

      if (userIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `You cannot update ${fields.join(" and ")} of a higher or equal role level`,
        };
      }

      const requiredPermissions = PERMISSIONS.role.update;
      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestPermittedLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

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

      const highestPermittedLevelIsLowerOrEqualRank =
        highestPermittedLevel >= targetRole.roleLevel;

      if (highestPermittedLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `You cannot update ${fields.join(" and ")} of a higher or equal role level`,
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Update permission granted",
      };
    },
    member: (user, chat, { targetRole }) => {
      const { isDefaultRole } = targetRole;
      const isUserMember = chat.members.includes(user.id);
      const isUserOwner = chat.ownerId === user.id;

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to update roles",
        };
      }

      if (isDefaultRole) {
        return {
          allowed: false,
          code: "forbidden",
          reason: "You are not allowed to modify members of a default role",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can update roles",
        };
      }

      const userLevel = getHighestRoleLevel(user);

      const userIsLowerOrEqualRank = userLevel >= targetRole?.roleLevel;

      if (userIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `You cannot update members of a higher or equal role level`,
        };
      }

      const requiredPermissions = PERMISSIONS.role.update;
      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestPermittedLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

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

      const highestPermittedLevelIsLowerOrEqualRank =
        highestPermittedLevel >= targetRole.roleLevel;

      if (highestPermittedLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `You cannot update members of a higher or equal role level`,
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Update permission granted",
      };
    },
    roleLevel: (user, chat, { targetRoles }) => {
      const isUserMember = chat.members.includes(user.id);

      if (!isUserMember) {
        return {
          allowed: false,
          code: chat.isPrivate ? "not_found" : "forbidden",
          reason: chat.isPrivate
            ? "Chat not found"
            : "You must be a chat member to update roles",
        };
      }

      const hasDefaultRole = targetRoles.some((role) => role.isDefaultRole);
      const isUserOwner = chat.ownerId === user.id;

      if (hasDefaultRole) {
        return {
          allowed: false,
          code: "forbidden",
          reason:
            "You are not allowed to modify the role level of a default role",
        };
      }

      if (isUserOwner) {
        return {
          allowed: true,
          code: "ok",
          reason: "Chat owner can update roles",
        };
      }

      const requiredPermissions = PERMISSIONS.role.update;
      const filteredRoles = getRolesWithRequiredPermissions(
        user,
        requiredPermissions
      );

      const highestPermittedLevel = getHighestRoleLevel({
        roles: filteredRoles,
      });

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

      const highestPermittedLevelIsLowerOrEqualRank = targetRoles.some(
        (targetRole) => highestPermittedLevel >= targetRole?.roleLevel
      );

      if (highestPermittedLevelIsLowerOrEqualRank) {
        return {
          allowed: false,
          code: "forbidden",
          reason: `You cannot update the role level of a higher or equal role level`,
        };
      }

      return {
        allowed: true,
        code: "ok",
        reason: "Update permission granted",
      };
    },
  },
  delete: (user, chat, { targetRole }) => {
    const { isDefaultRole } = targetRole;
    const isUserMember = chat.members.includes(user.id);

    if (!isUserMember) {
      return {
        allowed: false,
        code: chat.isPrivate ? "not_found" : "forbidden",
        reason: chat.isPrivate
          ? "Chat not found"
          : "You must be a chat member to update roles",
      };
    }

    if (isDefaultRole) {
      return {
        allowed: false,
        code: "forbidden",
        reason: "You are not allowed to delete a default role",
      };
    }

    const isUserOwner = user.id === chat.ownerId;

    if (isUserOwner) {
      return {
        allowed: true,
        code: "ok",
        reason: "Chat owner can delete roles",
      };
    }

    const requiredPermissions = PERMISSIONS.role.update;
    const filteredRoles = getRolesWithRequiredPermissions(
      user,
      requiredPermissions
    );

    const highestPermittedLevel = getHighestRoleLevel({
      roles: filteredRoles,
    });

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

    const highestPermittedLevelIsLowerOrEqualRank =
      highestPermittedLevel >= targetRole?.roleLevel;

    if (highestPermittedLevelIsLowerOrEqualRank) {
      return {
        allowed: false,
        code: "forbidden",
        reason: `You cannot delete a higher or equal role level`,
      };
    }

    return {
      allowed: true,
      code: "ok",
      reason: "Delete permission granted",
    };
  },
};
