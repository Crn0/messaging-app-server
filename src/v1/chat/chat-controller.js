import "dotenv/config";
import { unlink } from "fs/promises";
import Debug from "./debug.js";
import { tryCatchAsync } from "../helpers/index.js";
import { httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";

const debug = Debug.extend("controller");

const cleanFiles = async (files) => {
  if (files?.length > 0) {
    return Promise.allSettled(files.map((file) => unlink(file.path)));
  }

  if (!Array.isArray(files) && typeof files === "object" && files !== null) {
    return unlink(files.path);
  }

  return Promise.resolve();
};

// ===============
// CHAT CONTROLLER
// ===============

const createCreateChat =
  ({ chatService }) =>
  async (req, res, next) => {
    const { type, chatId, memberIds, name, avatar: file } = req.body;
    const ownerId = req.user.id;

    const { error, data } = await tryCatchAsync(() => {
      if (type === "DirectChat") {
        return chatService.createDirectChat({ chatId, memberIds });
      }

      return chatService.createGroupChat({ ownerId, name, file });
    });

    if (error) return next(error);

    if (file?.path && process.env.NODE_ENV !== "test") {
      unlink(file.path);
    }

    return res.status(httpStatus.OK).json(data);
  };

const createGetChat =
  ({ utils }) =>
  async (req, res, next) => {
    const { chat } = req.ctx || {};

    if (!chat)
      return next(new APIError("Chat not found", httpStatus.NOT_FOUND));

    const fieldsToRemove = ["members"];

    const cleanChat = utils.removeFields(chat, fieldsToRemove);

    return res.status(httpStatus.OK).json(cleanChat);
  };

const createGetChats =
  ({ chatService }) =>
  async (req, res, next) => {
    const memberId = req.user.id;

    const { error, data: chats } = await tryCatchAsync(
      chatService.getChatsByMemberId(memberId)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(chats);
  };

const createGetPublicChats =
  ({ chatService }) =>
  async (req, res, next) => {
    const { before, after } = req.query;

    const { error, data } = await tryCatchAsync(
      chatService.getPublicGroupChats({ before, after })
    );

    if (error) return next(error);

    const { chats, prevHref, nextHref } = data;

    return res
      .status(httpStatus.OK)
      .json({ chats, pagination: { prevHref, nextHref } });
  };

const createUpdateChatName =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { name } = req.body;

    const { error, data } = await tryCatchAsync(() =>
      chatService.updateGroupChatNameById({ chatId, name })
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(data);
  };

const createUpdateChatAvatar =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { type, avatar: file } = req.body;

    const { error, data } = await tryCatchAsync(() =>
      chatService.updateGroupChatAvatarById({ chatId, file, type })
    );

    if (error) return next(error);

    if (file?.path && process.env.NODE_ENV !== "test") {
      unlink(file.path);
    }

    return res.status(httpStatus.OK).json(data);
  };

const createDeleteChat =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;

    const { error, data } = await tryCatchAsync(() =>
      chatService.deleteGroupChatById(chatId)
    );

    if (error) return next(error);

    debug("deleted chat", data);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

// ===============
// MEMBER CONTROLLER
// ===============

const createMemberJoin =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { id: memberId } = req.user;

    const { error, data } = await tryCatchAsync(() =>
      chatService.addMember({ chatId, memberId })
    );

    if (error) return next(error);

    debug("User successfully joined the chat", data);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createGetMember =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId, memberId } = req.params;

    const { error, data } = await tryCatchAsync(
      chatService.getMemberById(chatId, memberId)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(data);
  };

const createGetMembers =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { before, after } = req.query;

    const { error, data } = await tryCatchAsync(
      chatService.getMembersById(chatId, { before, after })
    );

    if (error) return next(error);

    const { members, prevHref, nextHref } = data;

    return res
      .status(httpStatus.OK)
      .json({ members, pagination: { prevHref, nextHref } });
  };

const createMuteMember =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId, memberId } = req.params;
    const { mutedUntil } = req.body;

    const { error } = await tryCatchAsync(() =>
      chatService.updateMemberMutedUntil(chatId, { memberId, mutedUntil })
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createUnMuteMember =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId, memberId } = req.params;
    const { mutedUntil } = req.body;

    const { error } = await tryCatchAsync(() =>
      chatService.updateMemberMutedUntil(chatId, { memberId, mutedUntil })
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createDeleteMember =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    // Get memberId either from request params or use the current user's ID
    const memberId = req.params.memberId ?? req.user.id;

    const { error } = await tryCatchAsync(() =>
      chatService.revokeGroupChatMembership(chatId, memberId)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

// ===============
// ROLE CONTROLLER
// ===============

const createCreateRole =
  ({ roleService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { name } = req.body;

    const { error, data: role } = await tryCatchAsync(() =>
      roleService.createRole({ chatId, name })
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(role);
  };

const createGetRoles =
  ({ roleService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;

    const { error, data: roles } = await tryCatchAsync(() =>
      roleService.getChatRolesById(chatId)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(roles);
  };

const createGetRole =
  ({ roleService }) =>
  async (req, res, next) => {
    const { chatId, roleId } = req.params;

    const { error, data: role } = await tryCatchAsync(() =>
      roleService.getChatRoleById(roleId, chatId)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(role);
  };

const createUpdateRoleMetaData =
  ({ roleService }) =>
  async (req, res, next) => {
    const { roleId, chatId } = req.params;

    const { error } = await tryCatchAsync(() =>
      roleService.updateChatRoleMetaData(roleId, chatId, req.body)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createUpdateRoleMembers =
  ({ roleService }) =>
  async (req, res, next) => {
    const { roleId, chatId } = req.params;

    const { error } = await tryCatchAsync(() =>
      roleService.updateChatRoleMembers(roleId, chatId, req.body)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createUpdateRoleLevels =
  ({ roleService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;

    const { error } = await tryCatchAsync(() =>
      roleService.updateChatRoleRoleLevels(chatId, req.body)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createDeleteRoleMember =
  ({ roleService }) =>
  async (req, res, next) => {
    const { roleId, chatId, memberId } = req.params;

    const { error } = await tryCatchAsync(() =>
      roleService.deleteChatRoleMemberById(chatId, roleId, memberId)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createDeleteRole =
  ({ roleService }) =>
  async (req, res, next) => {
    const { roleId, chatId } = req.params;

    const { error } = await tryCatchAsync(() =>
      roleService.deleteChatRoleById(roleId, chatId)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

// ===================
// MESSAGE CONTROLLER
// ===================

const createGetMessages =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { before, after } = req.query;

    const { error, data } = await tryCatchAsync(
      chatService.getMessagesById(chatId, { before, after })
    );

    if (error) return next(error);

    const { messages, prevHref, nextHref } = data;

    return res
      .status(httpStatus.OK)
      .json({ messages, pagination: { prevHref, nextHref } });
  };

const createSendMessage =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;
    const files = req?.files;

    const data = {
      chatId,
      senderId,
      content,
      files,
    };

    const { error, data: message } = await tryCatchAsync(
      () => chatService.sendMessage(data),
      () => cleanFiles(files)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(message);
  };

const createSendReply =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;
    const files = req?.files;

    const data = {
      chatId,
      messageId,
      senderId,
      content,
      files,
    };

    const { error, data: message } = await tryCatchAsync(
      () => chatService.sendReply(data),
      () => cleanFiles(files)
    );

    if (error) return next(error);

    return res.status(httpStatus.OK).json(message);
  };

const createDeleteMessage =
  ({ chatService }) =>
  async (req, res, next) => {
    const { chatId, messageId } = req.params;

    const { error, data: message } = await tryCatchAsync(() =>
      chatService.deleteMessageById(chatId, messageId)
    );

    if (error) return next(error);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

export default (dependencies) => {
  const createChat = createCreateChat(dependencies);

  const getChat = createGetChat(dependencies);
  const getChats = createGetChats(dependencies);
  const getPublicChats = createGetPublicChats(dependencies);

  const updateChatName = createUpdateChatName(dependencies);
  const updateChatAvatar = createUpdateChatAvatar(dependencies);
  const deleteChat = createDeleteChat(dependencies);

  const memberJoin = createMemberJoin(dependencies);

  const getMember = createGetMember(dependencies);
  const getMemmbers = createGetMembers(dependencies);

  const muteMember = createMuteMember(dependencies);
  const unMuteMember = createUnMuteMember(dependencies);

  const deleteMember = createDeleteMember(dependencies);

  const createRole = createCreateRole(dependencies);

  const getRoles = createGetRoles(dependencies);
  const getRole = createGetRole(dependencies);

  const updateRoleMetaData = createUpdateRoleMetaData(dependencies);
  const updateRoleMembers = createUpdateRoleMembers(dependencies);
  const updateRoleLevels = createUpdateRoleLevels(dependencies);

  const deleteRoleMember = createDeleteRoleMember(dependencies);
  const deleteRole = createDeleteRole(dependencies);

  const getMessages = createGetMessages(dependencies);

  const sendMessage = createSendMessage(dependencies);
  const sendReply = createSendReply(dependencies);

  const deleteMessage = createDeleteMessage(dependencies);

  return Object.freeze({
    createChat,
    getChat,
    getChats,
    getPublicChats,
    updateChatName,
    updateChatAvatar,
    deleteChat,
    memberJoin,
    getMember,
    getMemmbers,
    muteMember,
    unMuteMember,
    deleteMember,
    createRole,
    getRoles,
    getRole,
    updateRoleMetaData,
    updateRoleMembers,
    updateRoleLevels,
    deleteRoleMember,
    deleteRole,
    getMessages,
    sendMessage,
    sendReply,
    deleteMessage,
  });
};
