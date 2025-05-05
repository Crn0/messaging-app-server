import Debug from "./debug.js";
import { env, httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";
import StorageError from "../../errors/storage-error.js";

const debug = Debug.extend("service");

const CHATS_PAGE_SIZE = 10;
const MESSAGES_PAGE_SIZE = 25;
const MEMBERS_PAGE_SIZE = 1000;

const pagination = ({ before, after, pageSize }) => {
  const cursor = before ?? after;
  const direction = (() => {
    if (after) return "forward";
    if (before) return "backward";

    return "none";
  })();

  return {
    cursor: cursor ? { id: cursor } : undefined,
    skip: direction === "none" ? 0 : 1,
    take: (direction === "backward" ? -1 : 1) * (pageSize + 1),
    direction,
  };
};

const createInsertDirectChat =
  ({ chatRepository, userService, roleService }) =>
  async (DTO) => {
    await Promise.all(
      DTO.membersId.map(async (id) => userService.getUserById(id))
    );

    const data = {
      chatId: DTO?.chatId,
      membersId: DTO.membersId,
    };

    const chat = await chatRepository.insertDirectChat(data);

    const defaultRole = await roleService.createDefaultRole({
      chatId: DTO?.chatId,
    });

    await roleService.updateChatRoleMembers({
      roleId: defaultRole?.id,
      chatId: DTO.chatId,
      membersId: DTO.membersId,
    });

    return chat;
  };

const createInsertGroupChat =
  ({ chatRepository, userService, roleService, utils, storage }) =>
  async (DTO) => {
    await userService.getUserById(DTO.ownerId);

    let asset;

    const chatId = utils.idGenerator();
    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${chatId}`;

    if (DTO.file) {
      const avatarEagerOptions = [
        // High-resolution display (WebP)
        {
          transformation: [
            { width: 256, height: 256, crop: "thumb", gravity: "face" },
            { radius: "max" }, // Circular crop
            { quality: "auto:best", fetch_format: "webp" },
          ],
        },
        // Tiny thumbnail
        {
          transformation: [
            { width: 64, height: 64, crop: "thumb", gravity: "face" },
            { radius: "max" },
            { quality: "auto:low", fetch_format: "webp" },
          ],
        },
        // Fallback (JPG for older browsers)
        {
          transformation: [
            { width: 256, height: 256, crop: "thumb", gravity: "face" },
            { radius: "max" },
            { quality: 80, fetch_format: "jpg" },
          ],
        },
      ];

      asset = await storage.upload(
        folder,
        DTO.file.path,
        DTO.file.mimetype,
        avatarEagerOptions
      );
    }

    const attachment = {
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      size: asset?.size,
      images: asset?.eager?.map?.(({ url: imageUrl, format, bytes }) => ({
        format,
        url: imageUrl,
        size: bytes,
      })),
    };

    const data = {
      chatId,
      attachment,
      ownerId: DTO.ownerId,
      name: DTO.name,
      isPrivate: false,
    };

    const chat = await chatRepository.insertGroupChat(data);

    const defaultRole = await roleService.createDefaultRole({
      chatId: chat.id,
    });

    await roleService.updateChatRoleMembers({
      roleId: defaultRole?.id,
      chatId: chat.id,
      membersId: [DTO.ownerId],
    });

    return chat;
  };

const createInsertMember =
  ({ chatRepository, userService, roleService }) =>
  async (DTO) => {
    await userService.getUserById(DTO.memberId);

    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chatExist.type === "DirectChat") {
      throw new APIError(
        "You don't have permission to join this chat",
        httpStatus.FORBIDDEN
      );
    }

    const data = {
      chatId: DTO.chatId,
      memberId: DTO.memberId,
      type: DTO.chatType,
    };

    const chat = await chatRepository.insertMember(data);

    const defaultRoles = await roleService.getChatDefaultRolesById(DTO.chatId);

    const defaultRolesId = defaultRoles?.map?.(({ id }) => id);

    try {
      if (defaultRolesId?.length > 0) {
        await Promise.all(
          defaultRolesId.map(async (roleId) =>
            roleService.updateChatRoleMember({
              roleId,
              chatId: DTO.chatId,
              memberId: DTO.memberId,
            })
          )
        );
      }
    } catch (e) {
      await chatRepository.revokeMembership({
        chatId: chat.id,
        memberId: DTO.memberId,
      });

      throw new APIError("Role assignment failed", httpStatus.INTERNAL_SERVER);
    }

    return chat;
  };

const createInsertMessage =
  ({ chatRepository, userService, storage }) =>
  async (DTO) => {
    await userService.getUserById(DTO.ownerId);

    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    let assets;
    const folder = `${env.CLOUDINARY_ROOT_NAME}/messages/${DTO.chatId}`;
    const attachmentEagerOptions = [
      // Medium preview (quick display in chat)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "auto" },
          { quality: "auto", fetch_format: "webp" },
        ],
      },

      // High-res fallback (for full-size view)
      {
        transformation: [
          { width: 1280, height: 1280, crop: "limit" },
          { quality: "auto:best", fetch_format: "webp" },
        ],
      },

      // Low-res for lazy loading
      {
        transformation: [
          { width: 8, height: 8, crop: "thumb", gravity: "auto" },
          { quality: "auto:low", fetch_format: "webp" },
        ],
      },
    ];

    if (DTO?.files?.length) {
      assets = await Promise.all([
        DTO.files.map((file) =>
          storage.upload(
            folder,
            file.path,
            file.mimetype,
            attachmentEagerOptions
          )
        ),
      ]);
    }

    const attachments = assets?.map?.((asset) => ({
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      images: asset?.eager?.map?.(({ url: imageUrl, format, bytes }) => ({
        format,
        url: imageUrl,
        size: bytes,
      })),
    }));

    const data = {
      chatId: DTO.chatId,
      senderId: DTO.senderId,
      content: DTO.content,
      attachments: attachments ?? null,
    };

    return chatRepository.insertMessage(data);
  };

const createInsertReply =
  ({ chatRepository, userService, storage }) =>
  async (DTO) => {
    await userService.getUserById(DTO.ownerId);

    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    let assets;
    const folder = `${env.CLOUDINARY_ROOT_NAME}/messages/${DTO.chatId}`;
    const attachmentEagerOptions = [
      // Medium preview (quick display in chat)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "auto" },
          { quality: "auto", fetch_format: "webp" },
        ],
      },

      // High-res fallback (for full-size view)
      {
        transformation: [
          { width: 1280, height: 1280, crop: "limit" },
          { quality: "auto:best", fetch_format: "webp" },
        ],
      },

      // Low-res for lazy loading
      {
        transformation: [
          { width: 8, height: 8, crop: "thumb", gravity: "auto" },
          { quality: "auto:low", fetch_format: "webp" },
        ],
      },
    ];

    if (DTO?.files?.length) {
      assets = await Promise.all([
        DTO.files.map((file) =>
          storage.upload(
            folder,
            file.path,
            file.mimetype,
            attachmentEagerOptions
          )
        ),
      ]);
    }

    const attachments = assets?.map?.((asset) => ({
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      images: asset?.eager?.map?.(({ url: imageUrl, format, bytes }) => ({
        format,
        url: imageUrl,
        size: bytes,
      })),
    }));

    const data = {
      chatId: DTO.chatId,
      senderId: DTO.senderId,
      messageId: DTO.messageId,
      content: DTO.content,
      attachments: attachments ?? null,
    };

    return chatRepository.insertReply(data);
  };

const createGetChatById =
  ({ chatRepository }) =>
  async (id) => {
    const chat = await chatRepository.findChatById(id);

    if (!chat) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    return chat;
  };

const createGetDirectChatByMembersId =
  ({ chatRepository, userService }) =>
  async (membersId) => {
    await Promise.all(
      membersId.map((memberId) => userService.getUserById(memberId))
    );

    const filter = {
      where: {
        type: "DirectChat",
        members: {
          every: {
            user: {
              id: {
                in: membersId,
              },
            },
          },
        },
      },
      include: {
        members: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    };

    const chats = await chatRepository.findChat(filter);

    return chats;
  };

const createGetChatMemberById =
  ({ chatRepository, userService }) =>
  async (chatId, userId) => {
    await userService.getUserById(userId);

    const chatExist = await chatRepository.findChatById(chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    const member = await chatRepository.findChatMemberById(chatId, userId);

    if (!member) {
      throw new APIError("Member not found", httpStatus.NOT_FOUND);
    }

    return member;
  };

const createGetChatMessageById =
  ({ chatRepository }) =>
  async (chatId, messageId) => {
    const chatExist = await chatRepository.findChatById(chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    const message = await chatRepository.findChatMessageById(chatId, messageId);

    if (!message) {
      throw new APIError("Message not found", httpStatus.NOT_FOUND);
    }

    return message;
  };

const createGetPublicGroupChats =
  ({ chatRepository }) =>
  async ({ before, after }) => {
    const pageSize = env.NODE_ENV === "test" ? 2 : CHATS_PAGE_SIZE;

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    const filter = {
      take,
      skip,
      cursor,
      where: {
        type: "GroupChat",
      },
    };

    const res = await chatRepository.findChats(filter);

    const chats =
      direction === "backward" ? res.slice(-pageSize) : res.slice(0, pageSize);

    const hasMore = res.length > pageSize;

    const nextHref =
      direction === "backward" || hasMore
        ? `/chats?after=${chats.at?.(-1)?.id}`
        : null;

    const prevHref =
      direction === "forward" || (direction === "backward" && hasMore)
        ? `/chats?before=${chats.at?.(0)?.id}`
        : null;

    return { chats, nextHref, prevHref };
  };

const createGetChatsByMemberId =
  ({ chatRepository, userService }) =>
  async (memberId) => {
    await userService.getUserById(memberId);

    const chats = await chatRepository.findChatsByMemberId(memberId);

    return chats;
  };

const createGetChatMembersById =
  ({ chatRepository }) =>
  async (chatId, { before, after }) => {
    const pageSize = env.NODE_ENV === "test" ? 1 : MEMBERS_PAGE_SIZE;

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    const filter = {
      take,
      skip,
      cursor,
    };

    const res = await chatRepository.findChatMembersById(chatId, filter);

    const members =
      direction === "backward" ? res.slice(-pageSize) : res.slice(0, pageSize);

    const hasMore = res.length > pageSize;

    const nextHref =
      direction === "backward" || hasMore
        ? `/members?after=${members.at?.(-1)?.id}`
        : null;

    const prevHref =
      direction === "forward" || (direction === "backward" && hasMore)
        ? `/members?before=${members.at?.(0)?.id}`
        : null;

    return { members, nextHref, prevHref };
  };

const createGetChatMessagesById =
  ({ chatRepository }) =>
  async (chatId, { before, after }) => {
    const pageSize = env.NODE_ENV === "test" ? 1 : MESSAGES_PAGE_SIZE;

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    const filter = {
      take,
      skip,
      cursor,
    };

    const res = await chatRepository.findChatMessagesById(chatId, filter);

    const messages =
      direction === "backward" ? res.slice(-pageSize) : res.slice(0, pageSize);

    const hasMore = res.length > pageSize;

    const nextHref =
      direction === "backward" || hasMore
        ? `/messages?after=${messages.at?.(-1)?.id}`
        : null;

    const prevHref =
      direction === "forward" || (direction === "backward" && hasMore)
        ? `/messages?before=${messages.at?.(0)?.id}`
        : null;

    return { messages, nextHref, prevHref };
  };

const createUpdateGroupChatNameById =
  ({ chatRepository }) =>
  async (DTO) => {
    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chatExist.type === "DirectChat") {
      throw new APIError(
        "You are not authorized to perform this action",
        httpStatus.FORBIDDEN
      );
    }

    const data = {
      chatId: DTO.chatId,
      name: DTO.name,
      type: "GroupChat",
    };

    const chat = await chatRepository.updateChatNameById(data);

    return chat;
  };

const createUpdateGroupChatAvatarById =
  ({ chatRepository, storage }) =>
  async (DTO) => {
    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chatExist.type === "DirectChat") {
      throw new APIError(
        "You are not authorized to perform this action",
        httpStatus.FORBIDDEN
      );
    }

    let asset;

    const prevAvatarId = chatExist?.avatar?.id;

    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${chatExist.id}`;

    const avatarEagerOptions = [
      // High-resolution display (WebP)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "face" },
          { radius: "max" }, // Circular crop
          { quality: "auto:best", fetch_format: "webp" },
        ],
      },
      // Tiny thumbnail
      {
        transformation: [
          { width: 64, height: 64, crop: "thumb", gravity: "face" },
          { radius: "max" },
          { quality: "auto:low", fetch_format: "webp" },
        ],
      },
      // Fallback (JPG for older browsers)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "face" },
          { radius: "max" },
          { quality: 80, fetch_format: "jpg" },
        ],
      },
    ];

    if (prevAvatarId) {
      asset = await storage.update(
        DTO.file.path,
        prevAvatarId,
        avatarEagerOptions
      );
    } else {
      asset = await storage.upload(
        folder,
        DTO.file.path,
        DTO.file.mimetype,
        avatarEagerOptions
      );
    }

    const attachment = {
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      size: asset?.bytes,
      images: asset?.eager?.map?.(({ url: imageUrl, format, bytes }) => ({
        format,
        url: imageUrl,
        size: bytes,
      })),
    };

    const data = {
      attachment,
      chatId: DTO.chatId,
      type: "GroupChat",
    };

    return chatRepository.updateChatAvatar(data);
  };

const createDeleteGroupChatById =
  ({ chatRepository, storage }) =>
  async (id) => {
    const chatExist = await chatRepository.findChatById(id);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chatExist.type === "DirectChat") {
      throw new APIError(
        "You are not authorized to perform this action",
        httpStatus.FORBIDDEN
      );
    }

    const chatAvatarPath = `${env.CLOUDINARY_ROOT_NAME}/avatars/${id}`;
    const messageAssetPath = `${env.CLOUDINARY_ROOT_NAME}/messages/${id}`;

    try {
      const res = await Promise.all([
        storage.destroyFolder(chatAvatarPath),
        storage.destroyFolder(messageAssetPath),
      ]);

      debug("Successfully deleted assets", res);
    } catch (e) {
      if (e instanceof StorageError && e.httpCode !== 404) throw e;

      debug("Error deleting assets", e);
    }

    await Promise.all([
      storage.destroyFolder(chatAvatarPath),
      storage.destroyFolder(messageAssetPath),
    ])
      .then((res) => {
        debug("Successfully deleted assets", res);
      })
      .catch((e) => {
        debug("Error deleting assets", e);
      });

    return chatRepository.deleteChatById(id);
  };

const createRevokeGroupChatMembership =
  ({ chatRepository, userService }) =>
  async (chatId, memberId) => {
    await userService.getUserById(memberId);

    const chatExist = await chatRepository.findChatById(chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chatExist.type === "DirectChat") {
      throw new APIError(
        "You are not authorized to perform this action",
        httpStatus.FORBIDDEN
      );
    }

    const data = {
      chatId,
      memberId,
      type: "GroupChat",
    };

    return chatRepository.revokeMembership(data);
  };

const createDeleteMessageById =
  ({ chatRepository, storage }) =>
  async (chatId, messageId) => {
    const messageExist = await chatRepository.findChatMessageById(
      chatId,
      messageId
    );

    if (!messageExist || messageExist.deletedAt) {
      throw new APIError("Message not found", httpStatus.NOT_FOUND);
    }

    const { attachments } = messageExist;

    if (attachments?.length) {
      await Promise.all(
        attachments.map(async (attachment) =>
          storage.destroyFile(
            attachment.id,
            attachment.type === "Epub" ? "raw" : "image"
          )
        )
      );
    }

    return chatRepository.deleteMessageById(chatId, messageId);
  };

export default (dependencies) => {
  const createDirectChat = createInsertDirectChat(dependencies);
  const createGroupChat = createInsertGroupChat(dependencies);

  const addMember = createInsertMember(dependencies);
  const sendMessage = createInsertMessage(dependencies);
  const sendReply = createInsertReply(dependencies);

  const getChatById = createGetChatById(dependencies);
  const getDirectChatByMembersId = createGetDirectChatByMembersId(dependencies);
  const getMemberById = createGetChatMemberById(dependencies);
  const getMessageById = createGetChatMessageById(dependencies);

  const getPublicGroupChats = createGetPublicGroupChats(dependencies);
  const getChatsByMemberId = createGetChatsByMemberId(dependencies);
  const getMembersById = createGetChatMembersById(dependencies);
  const getMessagesById = createGetChatMessagesById(dependencies);

  const updateGroupChatNameById = createUpdateGroupChatNameById(dependencies);
  const updateGroupChatAvatarById =
    createUpdateGroupChatAvatarById(dependencies);

  const revokeGroupChatMembership =
    createRevokeGroupChatMembership(dependencies);

  const deleteGroupChatById = createDeleteGroupChatById(dependencies);
  const deleteMessageById = createDeleteMessageById(dependencies);

  return Object.freeze({
    createDirectChat,
    createGroupChat,
    addMember,
    sendMessage,
    sendReply,
    getChatById,
    getDirectChatByMembersId,
    getMemberById,
    getMessageById,
    getPublicGroupChats,
    getChatsByMemberId,
    getMembersById,
    getMessagesById,
    updateGroupChatNameById,
    updateGroupChatAvatarById,
    revokeGroupChatMembership,
    deleteGroupChatById,
    deleteMessageById,
  });
};

export {
  createGetChatById,
  createGetChatMemberById,
  createGetChatMessageById,
  createGetPublicGroupChats,
  createGetChatMembersById,
  createGetChatMessagesById,
};
