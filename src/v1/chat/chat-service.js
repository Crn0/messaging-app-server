import Debug from "./debug.js";
import { env, httpStatus } from "../../constants/index.js";
import eager from "../user/profile/eager.js";
import APIError from "../../errors/api-error.js";
import StorageError from "../../errors/storage-error.js";

const debug = Debug.extend("service");

const CHATS_PAGE_SIZE = env.NODE_ENV === "test" ? 2 : 10;
const MESSAGES_PAGE_SIZE = env.NODE_ENV === "test" ? 1 : 25;
const MEMBERS_PAGE_SIZE = env.NODE_ENV === "test" ? 1 : 100;

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
      DTO.memberIds.map(async (id) => userService.getUserById(id))
    );

    const data = {
      memberIds: DTO.memberIds,
    };

    const chat = await chatRepository.insertDirectChat(data);

    const defaultRole = await roleService.createDefaultRole({
      chatId: chat.id,
    });

    await roleService.updateChatRoleMembers(defaultRole?.id, chat.id, {
      memberIds: DTO.memberIds,
    });

    return chat;
  };

const createInsertGroupChat =
  ({ chatRepository, userService, roleService, utils, storage }) =>
  async (DTO) => {
    const user = await userService.getUserById(DTO.ownerId);

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
      name:
        DTO.name ||
        `${user.profile?.displayName ?? user.username}'s group chat`,
      isPrivate: false,
    };

    const chat = await chatRepository.insertGroupChat(data);

    const defaultRole = await roleService.createDefaultRole({
      chatId: chat.id,
    });

    await roleService.updateChatRoleMembers(defaultRole?.id, chat.id, {
      memberIds: [DTO.ownerId],
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
      type: "GroupChat",
    };

    const chat = await chatRepository.insertMember(data);

    const defaultRoles = await roleService.getChatDefaultRolesById(DTO.chatId);

    const defaultRolesId = defaultRoles?.map?.(({ id }) => id);

    try {
      if (defaultRolesId?.length > 0) {
        await Promise.all(
          defaultRolesId.map(async (roleId) =>
            roleService.updateChatRoleMember(roleId, DTO.chatId, {
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
    await userService.getUserById(DTO.senderId);

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
      assets = await Promise.all(
        DTO.files.map((file) =>
          storage.upload(
            folder,
            file.path,
            file.mimetype,
            attachmentEagerOptions
          )
        )
      );
    }

    const attachments = assets?.map?.((asset) => ({
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      size: asset?.bytes,
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
    await userService.getUserById(DTO.senderId);

    const chatExist = await chatRepository.findChatById(DTO.chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    const messageExist = await chatRepository.findChatMessageById(
      DTO.chatId,
      DTO.messageId
    );

    if (!messageExist) {
      throw new APIError("Message not found", httpStatus.NOT_FOUND);
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
      assets = await Promise.all(
        DTO.files.map((file) =>
          storage.upload(
            folder,
            file.path,
            file.mimetype,
            attachmentEagerOptions
          )
        )
      );
    }

    const attachments = assets?.map?.((asset) => ({
      id: asset?.public_id,
      name: asset?.original_filename,
      url: asset?.secure_url,
      size: asset?.bytes,
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
  async (id, user) => {
    const chat = await chatRepository.findChatById(id);

    if (!chat) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    if (chat.type === "GroupChat") {
      return chat;
    }

    return {
      ...chat,
      avatar:
        chat?.tempAvatars?.filter?.((u) => u.id !== user?.id)?.avatar ?? null,
    };
  };

const createGetDirectChatByMembersId =
  ({ chatRepository, userService }) =>
  async (memberIds) => {
    await Promise.all(
      memberIds.map((memberId) => userService.getUserById(memberId))
    );

    const filter = {
      where: {
        type: "DirectChat",
        members: {
          every: {
            user: {
              id: {
                in: memberIds,
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
  ({ chatRepository }) =>
  async (chatId, userId) => {
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
    const pageSize = CHATS_PAGE_SIZE;

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    if (cursor?.id) {
      const cursorItem = await chatRepository.findChatById(cursor.id);

      if (!cursorItem) {
        throw new APIError("Invalid cursor", httpStatus.BAD_REQUEST);
      }
    }

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

    return chats.map((chat) => {
      if (chat.type !== "DirectChat") return chat;

      const tempAvatars = chat?.tempAvatars;

      return {
        ...chat,
        avatar: tempAvatars?.filter?.((u) => u.id !== memberId)?.avatar ?? null,
      };
    });
  };

const createGetChatMembersById =
  ({ chatRepository }) =>
  async (chatId, { before, after }) => {
    const pageSize = MEMBERS_PAGE_SIZE;

    const chat = await chatRepository.findChatById(chatId);

    if (chat?.type === "DirectChat") {
      const members = await chatRepository.findChatMembersById(chatId);

      return { members, nextHref: null, prevHref: null };
    }

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    if (cursor?.id) {
      const cursorItem = await chatRepository.findChatMemberById(
        chatId,
        cursor.id
      );

      if (!cursorItem) {
        throw new APIError("Invalid cursor", httpStatus.BAD_REQUEST);
      }
    }

    const filter = {
      take,
      skip,
      cursor,
    };

    const [res, memberCount] = await Promise.all([
      chatRepository.findChatMembersById(chatId, filter),
      chatRepository.findChatMemberCountById(chatId),
    ]);

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

    return { members, memberCount, nextHref, prevHref };
  };

const createGetChatMessagesById =
  ({ chatRepository }) =>
  async (chatId, { before, after }) => {
    const pageSize = MESSAGES_PAGE_SIZE;

    const { cursor, take, skip, direction } = pagination({
      before,
      after,
      pageSize,
    });

    if (cursor?.id) {
      const cursorItem = await chatRepository.findChatMessageById(
        chatId,
        cursor.id
      );

      if (!cursorItem) {
        throw new APIError("Invalid cursor", httpStatus.BAD_REQUEST);
      }
    }

    const filter = {
      take,
      skip,
      cursor,
      orderBy: {
        createdAt: "desc",
      },
    };

    const res = await chatRepository.findChatMessagesById(chatId, filter);

    const messages =
      direction === "backward" ? res.slice(-pageSize) : res.slice(0, pageSize);

    const reversedMessages =
      messages?.toReversed?.() ?? [...messages].reverse() ?? [];

    const hasMore = res.length > pageSize;

    const nextHref =
      direction === "backward" || hasMore
        ? `/messages?after=${messages.at?.(-1)?.id}`
        : null;

    const prevHref =
      direction === "forward" || (direction === "backward" && hasMore)
        ? `/messages?before=${messages.at?.(0)?.id}`
        : null;

    return {
      messages: reversedMessages,
      nextHref,
      prevHref,
    };
  };

const createGetUserMessagesById =
  ({ chatRepository }) =>
  async (userId) => {
    const messages = await chatRepository.findUserMessagesById(userId);

    return messages;
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

const createUpdateChatProfileById =
  ({ chatRepository, storage }) =>
  async (chatId, DTO) => {
    let asset;
    const chat = await chatRepository.findChatById(chatId);

    const prevAvatarId = chat?.avatar?.id;

    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${chat.id}`;
    const data = {
      name: DTO.name,
    };

    return chatRepository.transaction(
      async (tx) => {
        try {
          if (DTO.avatar) {
            if (prevAvatarId) {
              asset = await storage.update(
                DTO.avatar.path,
                prevAvatarId,
                eager.avatar
              );
            } else {
              asset = await storage.upload(
                folder,
                DTO.avatar.path,
                DTO.avatar.mimetype,
                eager.avatar
              );
            }
          }

          if (asset) {
            const {
              public_id: id,
              secure_url: url,
              eager: images,
              bytes: size,
              original_filename: fileName,
            } = asset;

            asset = {
              id,
              url,
              size,
              fileName,
              images: images.map((image) => ({
                url: image.secure_url,
                format: image.format,
                size: image.bytes,
              })),
            };

            data.avatar = {
              upsert: {
                where: {
                  id: asset.id,
                },
                update: {
                  id: asset.id,
                  name: asset.fileName,
                  url: asset.url,
                  images: {
                    deleteMany: {},
                    create: asset.images,
                  },
                  size: asset.size,
                  updatedAt: new Date(),
                },
                create: {
                  id: asset.id,
                  name: asset.fileName,
                  url: asset.url,
                  images: {
                    create: asset.images,
                  },
                  size: asset.size,
                  type: "Image",
                },
              },
            };
          }

          return await tx.chat.update({
            data,
            where: {
              id: chat.id,
            },
          });
        } catch (e) {
          if (asset?.id) {
            storage.destroyFile(asset.id, "image");
          }

          throw e;
        }
      },
      {
        timeout: env.TRANSACTION_MAX_TIMEOUT,
      }
    );

    // if (prevAvatarId) {
    //   asset = await storage.update(DTO.file.path, prevAvatarId, eager.avatar);
    // } else {
    //   asset = await storage.upload(
    //     folder,
    //     DTO.file.path,
    //     DTO.file.mimetype,
    //     eager.avatar
    //   );
    // }

    // const attachment = {
    //   id: asset?.public_id,
    //   name: asset?.original_filename,
    //   url: asset?.secure_url,
    //   size: asset?.bytes,
    //   images: asset?.eager?.map?.(({ url: imageUrl, format, bytes }) => ({
    //     format,
    //     url: imageUrl,
    //     size: bytes,
    //   })),
    // };

    // const data = {
    //   attachment,
    //   chatId: DTO.chatId,
    //   type: "GroupChat",
    // };

    // return chatRepository.updateChatAvatar(data);
  };

const createUpdateMemberMutedUntil =
  ({ chatRepository }) =>
  async (chatId, DTO) => {
    const chatExist = await chatRepository.findChatById(chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    const member = await chatRepository.findChatMemberById(
      chatId,
      DTO.memberId
    );

    if (!member) {
      throw new APIError("Member not found", httpStatus.NOT_FOUND);
    }

    const data = {
      memberId: DTO.memberId,
      mutedUntil: DTO.mutedUntil,
      chatType: chatExist.type,
    };

    return chatRepository.updateMembermutedUntil(chatId, data);
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

    return chatRepository.deleteChatById(id);
  };

const createRevokeGroupChatMembership =
  ({ chatRepository }) =>
  async (chatId, memberId) => {
    const chatExist = await chatRepository.findChatById(chatId);

    if (!chatExist) {
      throw new APIError("Chat not found", httpStatus.NOT_FOUND);
    }

    const member = await chatRepository.findChatMemberById(chatId, memberId);

    if (!member) {
      throw new APIError("Member not found", httpStatus.NOT_FOUND);
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
  const getUserMessagesById = createGetUserMessagesById(dependencies);

  const updateGroupChatNameById = createUpdateGroupChatNameById(dependencies);
  const updateGroupChatAvatarById =
    createUpdateGroupChatAvatarById(dependencies);
  const updateChatProfileById = createUpdateChatProfileById(dependencies);

  const updateMemberMutedUntil = createUpdateMemberMutedUntil(dependencies);

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
    getUserMessagesById,
    updateGroupChatNameById,
    updateGroupChatAvatarById,
    updateChatProfileById,
    updateMemberMutedUntil,
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
  createGetUserMessagesById,
  createDeleteMessageById,
};
