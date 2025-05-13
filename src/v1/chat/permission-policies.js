const CHAT_LIMITS = {
  maxDirectChats: 20,
  maxGroupChats: 20,
  roleLimits: 5,
};

const PERMISSIONS = {
  chat: {
    update: {
      name: ["manage_chat", "admin"],
      avatar: ["manage_chat", "admin"],
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
  },
};

const executePermissionCheck = (subject, data, requiredPermissions) =>
  subject.roles.some(
    (role) =>
      data.roles.some((dataRole) => dataRole.id === role.id) &&
      role.permissions.some((p) => requiredPermissions.includes(p.name))
  );

const getRolesWithRequiredPermissions = (subject, requiredPermissions) =>
  subject.roles.filter((role) =>
    role.permissions.some((p) => requiredPermissions.includes(p.name))
  );

const getHighestRoleLevel = (user) =>
  Math.min(
    ...(user?.roles?.reduce?.((arr, r) => {
      if (r.isDefaultRole) return arr;

      return arr.concat(r.roleLevel);
    }, []) ?? [])
  );

const PERMISSION_POLICIES = {
  chat: {
    create: {
      direct: (user, existingChat, { targetUser }) => {
        if (existingChat) {
          return {
            allow: false,
            code: "conflict",
            reason: "Direct chat already exists",
          };
        }

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

        const maxGroupChatsLimitReached =
          groupCount >= CHAT_LIMITS.maxGroupChats;

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
  },
  member: {
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
            reason:
              "You cannot unmute a member with higher or equal role level",
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
  },
  role: {
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
    view: (user, chat) => {
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
  },
};

export { CHAT_LIMITS, PERMISSIONS, PERMISSION_POLICIES };
