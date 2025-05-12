import { tryCatchAsync } from "../helpers/index.js";
import APIError from "../../errors/api-error.js";
import ValidationError from "../../errors/validation-error.js";

const createUploader =
  ({ multer, MulterError }) =>
  (field) =>
  (req, res, next) =>
    multer.single(field)(req, res, (err) => {
      if (err instanceof MulterError) {
        const { code } = err;

        if (code === "LIMIT_UNEXPECTED_FILE") {
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
    });

// ===============
// CHAT MIDDLEWARE
// ===============

const createCanCreateChat =
  ({ chatService, blockUserService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, membersId, type } = req.body;
    const user = { id: req.user.id };
    const targetUser = {};

    const [
      { error: chatsError, data: chats },
      { data: chatById },
      { data: chatByMembersId },
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatsByMemberId(user.id)),
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => chatService.getDirectChatByMembersId(membersId)),
    ]);

    if (chatsError) {
      return next(chatsError);
    }

    if (type === "DirectChat") {
      targetUser.id = membersId.reduce((id, nextId) =>
        user.id !== id ? id : nextId
      );

      const [
        { error: userBlockListError, data: userBlockList },
        { error: targetUserBlockListError, data: targetUserBlockList },
      ] = await Promise.all([
        tryCatchAsync(() => blockUserService.getUserBlockList(user.id)),
        tryCatchAsync(() => blockUserService.getUserBlockList(targetUser.id)),
      ]);

      if (userBlockListError || targetUserBlockListError) {
        return next(userBlockListError || targetUserBlockListError);
      }

      user.blockedUsers = userBlockList;
      targetUser.blockedUsers = targetUserBlockList;
    }

    const chat = chatById ?? chatByMembersId;

    user.chats = chats;

    const { success, code, message } = chatPolicy.chat.checkCreate(user, chat, {
      type,
      targetUser,
    });

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanViewChat =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
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
      { error: chatError, data: chat },
      { error: chatRolesError, data: chatRoles },
      { error: userRolesError, data: userRoles },
      { error: targetUserRolesError, data: targetUserRoles },
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, targetUser.id)),
    ]);

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
      { error: chatError, data: chat },
      { error: chatRolesError, data: chatRoles },
      { error: userRolesError, data: userRoles },
      { error: targetUserRolesError, data: targetUserRoles },
    ] = await Promise.all([
      tryCatchAsync(() => chatService.getChatById(chatId)),
      tryCatchAsync(() => roleService.getChatRolesById(chatId)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, user.id)),
      tryCatchAsync(() => roleService.getUserRolesById(chatId, targetUser.id)),
    ]);

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

    const { success, code, message } = chatPolicy.role.checkView(user, chat);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateRoleName =
  ({ chatService, roleService, chatPolicy }) =>
  async (req, _, next) => {
    const { chatId, roleId } = req.params;
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

    const { success, code, message } = chatPolicy.checkUpdateChatPermission(
      user,
      chat,
      "chat",
      "update",
      "avatar"
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

// =================
// MESSAGE MIDDLEWARE
// =================

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
  });
};
