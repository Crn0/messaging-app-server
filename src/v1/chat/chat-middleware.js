import { tryCatchAsync } from "../helpers/index.js";
import APIError from "../../errors/api-error.js";
import ValidationError from "../../errors/validation-error.js";

const createUploader = ({ multer, MulterError }) => ({
  single: (field) => (req, res, next) =>
    multer.single(field)(req, res, (err) => {
      if (err instanceof MulterError) {
        const { code } = err;

        if (code === "LIMIT_UNEXPECTED_FILE" || code === "LIMIT_FILE_COUNT") {
          return next(
            new ValidationError("Validation Error", [
              {
                code: "custom",
                message: "Only one file can be uploaded at a time",
                path: [field],
              },
            ])
          );
        }

        return next(err);
      }

      if (err) {
        return next(err);
      }

      return next();
    }),
  array: (field, maxCount) => (req, res, next) =>
    multer.array(field, maxCount)(req, res, (err) => {
      if (err instanceof MulterError) {
        const { code } = err;

        if (code === "LIMIT_UNEXPECTED_FILE" || code === "LIMIT_FILE_COUNT") {
          return next(
            new ValidationError("Validation Error", [
              {
                code: "custom",
                message: `No more than ${maxCount} attachments are allowed`,
                path: [field],
              },
            ])
          );
        }

        return next(err);
      }

      if (err) {
        return next(err);
      }

      return next();
    }),
});

// ===============
// CHAT MIDDLEWARE
// ===============
const createCanCreateChat =
  ({ chatService, blockUserService, chatPolicy }) =>
  async (req, _, next) => {
    const { memberIds, type } = req.body;
    const user = { id: req.user.id };
    const targetUser = {};

    const [chatsResult, chatByMembersIdResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatsByMemberId(user.id)),
      tryCatchAsync(() => chatService.getDirectChatByMembersId(memberIds)),
    ]);

    const { error: chatsError, data: chats } = chatsResult;
    const { data: chatByMembersId } = chatByMembersIdResult;

    const chat = chatByMembersId;

    if (chatsError) {
      return next(chatsError);
    }

    if (type === "DirectChat") {
      targetUser.id = memberIds.reduce((id, nextId) =>
        user.id !== id ? id : nextId
      );

      const [userBlockListResult, targetUserBlockListResult] =
        await Promise.all([
          tryCatchAsync(() => blockUserService.getUserBlockList(user.id)),
          tryCatchAsync(() => blockUserService.getUserBlockList(targetUser.id)),
        ]);

      const { error: userBlockListError, data: userBlockList } =
        userBlockListResult;
      const { error: targetUserBlockListError, data: targetUserBlockList } =
        targetUserBlockListResult;

      if (userBlockListError || targetUserBlockListError) {
        return next(userBlockListError || targetUserBlockListError);
      }

      user.blockedUsers = userBlockList;
      targetUser.blockedUsers = targetUserBlockList;
    }

    user.chats = chats;

    const { success, code, message } = chatPolicy.chat.checkCreate(user, chat, {
      type,
      targetUser,
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    if (type === "DirectChat") {
      req.ctx = {
        chat,
        ...req.ctx,
      };
    }

    return next();
  };

const createCanViewChat =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId, user)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.chat.checkView(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    req.ctx = {
      ...(req.ctx || {}),
      chat,
    };

    return next();
  };

const createCanUpdateChatName =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.chat.checkUpdate(user, chat, {
      field: "name",
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateChatAvatar =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.chat.checkUpdate(user, chat, {
      field: "avatar",
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanDeleteChat =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };
    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.chat.checkDelete(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

// =================
// MEMBER MIDDLEWARE
// =================

const createCanMemberJoin =
  ({ chatService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const { error: chatError, data: chat } = await tryCatchAsync(() =>
      chatService.getChatById(chatId)
    );

    if (chatError) {
      return next(chatError);
    }

    const { success, code, message } = chatPolicy.member.checkJoin(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanViewMember =
  ({ chatService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const { error: chatError, data: chat } = await tryCatchAsync(() =>
      chatService.getChatById(chatId)
    );

    if (chatError) {
      return next(chatError);
    }

    const { success, code, message } = chatPolicy.member.checkView(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanMuteMember =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { memberId } = req.params;
    const { mutedUntil } = req.body;

    const user = { id: req.user.id };
    const targetUser = { id: memberId };

    const [
      chatResult,
      chatRolesResult,
      userRolesResult,
      targetUserRolesResult,
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, targetUser.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    const { error: targetUserRolesError, data: targetUserRoles } =
      targetUserRolesResult;

    if (chatError || chatRolesError || userRolesError || targetUserRolesError) {
      return next(
        chatError || chatRolesError || userRolesError || targetUserRolesError
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;
    targetUser.roles = targetUserRoles;

    const { success, code, message } = chatPolicy.member.checkMute(
      user,
      chat,
      targetUser,
      mutedUntil === null ? "unmute" : "mute"
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanLeaveChat =
  ({ chatService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;

    const user = { id: req.user.id };

    const { error: chatError, data: chat } = await tryCatchAsync(() =>
      chatService.getChatById(chatId)
    );

    if (chatError) {
      return next(chatError);
    }

    const { success, code, message } = chatPolicy.member.checkLeave(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanKickMember =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { memberId } = req.params;

    const user = { id: req.user.id };
    const targetUser = { id: memberId };

    const [
      chatResult,
      chatRolesResult,
      userRolesResult,
      targetUserRolesResult,
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, targetUser.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    const { error: targetUserRolesError, data: targetUserRoles } =
      targetUserRolesResult;

    if (chatError || chatRolesError || userRolesError || targetUserRolesError) {
      return next(
        chatError || chatRolesError || userRolesError || targetUserRolesError
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;
    targetUser.roles = targetUserRoles;

    const { success, code, message } = chatPolicy.member.checkKick(
      user,
      chat,
      targetUser
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

// =================
// ROLE MIDDLEWARE
// =================

const createCanCreateRole =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const [
      { error: chatError, data: chat },
      { error: chatRolesError, data: chatRoles },
      { error: userRolesError, data: userRoles },
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.role.checkCreate(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanViewRole =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.role.checkView(user, chat, {
      targetUser: null,
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanViewUserRole =
  ({ chatService, chatPolicy }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const { error, data: chat } = await tryCatchAsync(() =>
      chatService.getChatById(chatId)
    );

    if (error) {
      return next(error);
    }

    const { success, code, message } = chatPolicy.role.checkView(user, chat, {
      targetUser: user,
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateRoleMetaData =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, roleId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult, targetRoleResult] =
      await Promise.all([
        tryCatchAsync(() => chatService.getChatById(chatId)),
        tryCatchAsync(() => roleService.getChatRolesById(chatId)),
        tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
        tryCatchAsync(() => roleService.getChatRoleById(roleId, chatId)),
      ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    const { error: targetRoleError, data: targetRole } = targetRoleResult;

    if (chatError || chatRolesError || userRolesError || targetRoleError) {
      return next(
        chatError || chatRolesError || userRolesError || targetRoleError
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const inputKeys = Object.keys(req.body);

    const roleFields = ["name", "permissions"].reduce((result, key) => {
      if (inputKeys.includes(key)) {
        return result.concat(key);
      }

      return result;
    }, []);

    const { success, code, message } = chatPolicy.role.checkUpdateMetaData(
      user,
      chat,
      {
        targetRole,
        fields: roleFields,
      }
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateRoleMembers =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, roleId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult, targetRoleResult] =
      await Promise.all([
        tryCatchAsync(() => chatService.getChatById(chatId)),
        tryCatchAsync(() => roleService.getChatRolesById(chatId)),
        tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
        tryCatchAsync(() => roleService.getChatRoleById(roleId, chatId)),
      ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    const { error: targetRoleError, data: targetRole } = targetRoleResult;

    if (chatError || chatRolesError || userRolesError || targetRoleError) {
      return next(
        chatError || chatRolesError || userRolesError || targetRoleError
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;
    const { success, code, message } = chatPolicy.role.checkUpdateMembers(
      user,
      chat,
      {
        targetRole,
      }
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateRoleLevels =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const { roleIds } = req.body;
    const user = { id: req.user.id };

    const targetRoleResults = await Promise.all(
      roleIds?.map?.((id) =>
        tryCatchAsync(() => roleService.getChatRoleById(id, chatId))
      )
    );

    const [chatResult, chatRolesResult, userRolesResult] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
    ]);

    const targetRoleErrors = targetRoleResults.find((r) => r.error)?.error;
    const targetRoles = targetRoleResults.map((r) => r.data);

    const { error: chatError, data: chat } = chatResult;

    const { error: chatRolesError, data: chatRoles } = chatRolesResult;

    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError || targetRoleErrors) {
      return next(
        chatError || chatRolesError || userRolesError || targetRoleErrors
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.role.checkUpdateRoleLevels(
      user,
      chat,
      {
        targetRoles,
      }
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanDeleteRole =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, roleId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult, targetRoleResult] =
      await Promise.all([
        tryCatchAsync(() => chatService.getChatById(chatId)),
        tryCatchAsync(() => roleService.getChatRolesById(chatId)),
        tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
        tryCatchAsync(() => roleService.getChatRoleById(roleId, chatId)),
      ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    const { error: targetRoleError, data: targetRole } = targetRoleResult;

    if (chatError || chatRolesError || userRolesError || targetRoleError) {
      return next(
        chatError || chatRolesError || userRolesError || targetRoleError
      );
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.role.checkDelete(user, chat, {
      targetRole,
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

// =================
// MESSAGE MIDDLEWARE
// =================

const createCanSendMessage =
  ({ chatService, roleService, blockUserService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const userId = req.user.id;
    const targetUser = {};

    const [chatResult, userResult, chatRolesResult, userRolesResult] =
      await Promise.all([
        tryCatchAsync(() => chatService.getChatById(chatId)),
        tryCatchAsync(() => chatService.getMemberById(chatId, userId)),
        tryCatchAsync(() => roleService.getChatRolesById(chatId)),
        tryCatchAsync(() => roleService.getUserRolesById(chatId, userId)),
      ]);

    let { data: user } = userResult;
    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    if (user === null) {
      user = { id: userId, roles: [], blockedUsers: [] };
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    if (chat?.type === "DirectChat") {
      const targetUserId = chat.members.find((id) => id !== user.id);

      targetUser.id = targetUserId;

      const [userBlockListResult, targetUserBlockListResult] =
        await Promise.all([
          tryCatchAsync(() => blockUserService.getUserBlockList(user.id)),
          tryCatchAsync(() => blockUserService.getUserBlockList(targetUser.id)),
        ]);

      const { data: userBlockList } = userBlockListResult;
      const { data: targetUserBlockList } = targetUserBlockListResult;

      if (userBlockListResult.error || targetUserBlockListResult.error) {
        return next(
          userBlockListResult.error || targetUserBlockListResult.error
        );
      }

      user.blockedUsers = userBlockList;
      targetUser.blockedUsers = targetUserBlockList;
    }

    const { success, code, message } = chatPolicy.message.checkSend(
      user,
      chat,
      { targetUser }
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanViewMessage =
  ({ chatService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId } = req.params;
    const user = { id: req.user.id };

    const { error: chatError, data: chat } = await tryCatchAsync(() =>
      chatService.getChatById(chatId)
    );

    if (chatError) {
      return next(chatError);
    }

    const { success, code, message } = chatPolicy.message.checkView(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanDeleteMessage =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, messageId } = req.params;
    const user = { id: req.user.id };

    const [chatResult, chatRolesResult, userRolesResult, targetMessageResult] =
      await Promise.all([
        tryCatchAsync(() => chatService.getChatById(chatId)),
        tryCatchAsync(() => roleService.getChatRolesById(chatId)),
        tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
        tryCatchAsync(() => chatService.getMessageById(chatId, messageId)),
      ]);

    const { error: chatError, data: chat } = chatResult;
    const { error: chatRolesError, data: chatRoles } = chatRolesResult;
    const { error: userRolesError, data: userRoles } = userRolesResult;
    let { data: targetMessage } = targetMessageResult;

    if (chatError || chatRolesError || userRolesError) {
      return next(chatError || chatRolesError || userRolesError);
    }

    if (targetMessage === null) {
      targetMessage = { user: { id: null } };
    }

    chat.roles = chatRoles;
    user.roles = userRoles;

    const { success, code, message } = chatPolicy.message.checkDelete(
      user,
      chat,
      {
        targetMessage,
      }
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

export default (dependencies) => {
  const uploader = createUploader(dependencies);

  const canViewChat = createCanViewChat(dependencies);

  const canCreateChat = createCanCreateChat(dependencies);

  const canUpdateChatName = createCanUpdateChatName(dependencies);
  const canUpdateChatAvatar = createCanUpdateChatAvatar(dependencies);

  const canDeleteChat = createCanDeleteChat(dependencies);

  const canViewMember = createCanViewMember(dependencies);

  const canMemberJoin = createCanMemberJoin(dependencies);

  const canMuteMember = createCanMuteMember(dependencies);

  const canLeaveChat = createCanLeaveChat(dependencies);
  const canKickMember = createCanKickMember(dependencies);

  const canCreateRole = createCanCreateRole(dependencies);

  const canViewRole = createCanViewRole(dependencies);
  const canViewUserRole = createCanViewUserRole(dependencies);

  const canUpdateRoleMetaData = createCanUpdateRoleMetaData(dependencies);
  const canUpdateRoleMembers = createCanUpdateRoleMembers(dependencies);
  const canUpdateRoleLevels = createCanUpdateRoleLevels(dependencies);

  const canDeleteRole = createCanDeleteRole(dependencies);

  const canViewMessage = createCanViewMessage(dependencies);

  const canSendMessage = createCanSendMessage(dependencies);

  const canDeleteMessage = createCanDeleteMessage(dependencies);

  return Object.freeze({
    uploader,
    canCreateChat,
    canViewChat,
    canUpdateChatName,
    canUpdateChatAvatar,
    canDeleteChat,
    canMemberJoin,
    canViewMember,
    canMuteMember,
    canLeaveChat,
    canKickMember,
    canCreateRole,
    canViewRole,
    canViewUserRole,
    canUpdateRoleMetaData,
    canUpdateRoleMembers,
    canUpdateRoleLevels,
    canDeleteRole,
    canViewMessage,
    canSendMessage,
    canDeleteMessage,
  });
};
