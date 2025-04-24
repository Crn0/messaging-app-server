import client from "../../db/client.js";
import { toData, toEntity } from "./chat-mapper.js";
import field from "./include.js";

const insertDirectChat = async ({ chatId, membersId }) => {
  const insertData = toData("insert", {
    chatId,
    memberId: membersId[0],
    type: "DirectChat",
  });

  const updateData = toData("update:member", {
    memberId: membersId[1],
    type: "DirectChat",
  });

  const chat = await client.chat.create({
    data: insertData,
  });

  const insertReceiver = await client.chat.update({
    where: {
      id: chat.id,
    },
    data: updateData,
    include: field.default,
  });

  return toEntity("Chat", insertReceiver);
};

const insertGroupChat = async ({
  chatId,
  name,
  ownerId,
  isPrivate,
  attachment,
}) => {
  const data = toData("insert", {
    chatId,
    name,
    ownerId,
    attachment,
    isPrivate,
    type: "GroupChat",
  });

  const chat = await client.chat.create({
    data,
    include: field.default,
  });

  return toEntity("Chat", chat);
};

const insertMember = async ({ chatId, memberId, type }) => {
  const data = toData("update:member", { memberId, type });

  const chat = await client.chat.update({
    data,
    where: {
      id: chatId,
    },
    include: {
      ...field.default,
      members: field.members,
    },
  });

  return toEntity("Chat", chat);
};

const insertMessage = async ({ chatId, senderId, content, attachments }) => {
  let files;

  const data = toData("insert:message", {
    chatId,
    senderId,
    content,
  });

  const message = await client.message.create({
    data,
    include: field.message,
  });

  if (attachments?.length) {
    files = await client.$transaction(
      attachments?.map((attachment) => {
        const attachmentData = toData("update:message:attachment", {
          attachment,
          chatId,
          messageId: message.id,
        });

        return client.attachment.create({
          data: attachmentData,
          include: field.attachment,
        });
      })
    );
  }

  message.attachments = files;

  return toEntity("Message", message);
};

const insertReply = async ({
  chatId,
  senderId,
  messageId,
  content,
  attachments,
}) => {
  let files;

  const data = toData("update:message:reply", {
    chatId,
    senderId,
    messageId,
    content,
    attachments,
  });

  const message = await client.message.create({
    data,
    include: field.message,
  });

  if (attachments?.length) {
    files = await client.$transaction(
      attachments?.map((attachment) => {
        const attachmentData = toData("update:message:attachment", {
          attachment,
          chatId,
          messageId: message.id,
        });

        return client.attachment.create({
          data: attachmentData,
          include: field.attachment,
        });
      })
    );
  }

  message.attachments = files;

  return toEntity("Message", message);
};

const findChatById = async (id) => {
  const chat = await client.chat.findUnique({
    where: { id },
    include: {
      ...field.default,
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
  });

  return toEntity("Chat", chat);
};

const findChatMessageById = async (chatId, messageId) => {
  const message = await client.message.findUnique({
    where: {
      id: messageId,
      chat: {
        id: chatId,
      },
    },
    include: field.message,
  });

  return toEntity("Message", message);
};

const findChatMemberById = async (chatId, userId) => {
  const members = await client.userOnChat.findMany({
    where: { chat: { id: chatId }, user: { id: userId } },
    include: field.userOnChat,
  });

  return members?.map?.((member) => toEntity("Member", member))[0] ?? null;
};

const findChats = async (type, filter) => {
  const chats = await client.chat.findMany({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { type, ...filter?.where },
    include: {
      ...field.default,
    },
  });

  return chats?.map?.((chat) => toEntity("Chat", chat));
};

const findChatMembersById = async (id, filter) => {
  const filterRef = filter;

  const userOnChats = await client.userOnChat.findMany({
    where: {
      chat: { id },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  const cursorId = userOnChats?.reduce?.((prev, next, i, arr) => {
    const { user } = prev;

    if (user.id === filter?.cursor?.id) {
      return prev.id;
    }
    if (user.id !== filter?.cursor?.id && i === arr.length - 1) {
      return undefined;
    }

    return next;
  });

  if (cursorId) {
    filterRef.cursor.id = cursorId;
  }

  const members = await client.userOnChat.findMany({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { chat: { id }, ...filter?.where },
    include: field.userOnChat,
  });

  return members?.map?.((member) => toEntity("Member", member)) ?? [];
};

const findChatMessagesById = async (id, filter) => {
  const messages = await client.message.findMany({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { chat: { id }, ...filter?.where },
    include: field.message,
  });

  return messages?.map?.((message) => toEntity("Message", message));
};

const updateChatNameById = async ({ chatId, name, type }) => {
  const data = toData("update:name", { chatId, name, type });

  const chat = await client.chat.update({
    data,
    where: {
      id: chatId,
    },
    include: field.default,
  });

  return toEntity("Chat", chat);
};

const updateChatAvatar = async ({ chatId, attachment, type }) => {
  const data = toData("upsert:avatar", { chatId, attachment, type });

  const chat = await client.chat.update({
    data,
    where: {
      id: chatId,
    },
    include: {
      avatar: field.avatar,
    },
  });

  return toEntity("Chat", chat);
};

const updateMessageDeletedAt = async ({ chatId, messageId, content }) => {
  const data = toData("update:message:deletedAt", {
    content,
  });

  const message = await client.message.update({
    data,
    where: {
      id: messageId,
      chat: {
        id: chatId,
      },
    },
    include: field.message,
  });

  return toEntity("Message", message);
};

const deleteChatById = async (id) => {
  const chat = await client.chat.delete({
    where: { id },
    include: {
      ...field.default,
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
  });

  return toEntity("Chat", chat);
};

const revokeMembership = async ({ chatId, memberId, type }) => {
  const userOnChat = await client.userOnChat.findFirst({
    where: {
      chat: { id: chatId },
      user: { id: memberId },
    },
    select: { id: true },
  });

  const data = toData("delete:member", { type, userOnChatId: userOnChat.id });

  const chat = await client.chat.update({
    data,
    where: {
      id: chatId,
    },
    include: {
      ...field.default,
      members: field.members,
    },
  });

  return toEntity("Chat", chat);
};

const deleteMessageById = async (chatId, messageId) => {
  const message = await client.message.delete({
    where: {
      id: messageId,
      chat: {
        id: chatId,
      },
    },
    include: field.message,
  });

  await client.message.deleteMany({
    where: {
      id: { in: [message.replyTo.id] },
      chat: {
        id: chatId,
      },
      deletedAt: {
        not: null,
      },
    },
  });

  return toEntity("Message", message);
};

export default {
  insertDirectChat,
  insertGroupChat,
  insertMember,
  insertMessage,
  insertReply,
  findChatById,
  findChatMessageById,
  findChatMemberById,
  findChats,
  findChatMembersById,
  findChatMessagesById,
  updateChatNameById,
  updateChatAvatar,
  updateMessageDeletedAt,
  deleteChatById,
  revokeMembership,
  deleteMessageById,
};
