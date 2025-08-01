import client from "../../db/client.js";
import { toData, toEntity } from "./chat-mapper.js";
import field from "./include.js";

const transaction = async (cb, ops) => client.$transaction(cb, ops);

const insertDirectChat = async ({ memberIds }) => {
  const userPks = (
    await client.user.findMany({
      where: { id: { in: memberIds } },
      select: { pk: true },
    })
  ).map(({ pk }) => pk);

  const insertData = toData("insert", {
    userPks,
    type: "DirectChat",
  });

  const chat = await client.chat.create({
    data: insertData,
  });

  await client.chatRoleCounter.create({
    data: { chatPk: chat.pk, lastLevel: 0 },
  });

  return toEntity("Chat", chat);
};

const insertGroupChat = async ({
  chatId,
  name,
  ownerId,
  isPrivate,
  attachment,
}) => {
  const owner = await client.user.findUnique({
    where: { id: ownerId },
    select: { pk: true },
  });

  const data = toData("insert", {
    chatId,
    name,
    ownerId,
    ownerPk: owner.pk,
    attachment,
    isPrivate,
    type: "GroupChat",
  });

  const chat = await client.chat.create({
    data,
    include: field.default,
  });

  await client.chatRoleCounter.create({
    data: { chatPk: chat.pk, lastLevel: 0 },
  });

  return toEntity("Chat", chat);
};

const insertMember = async ({ chatId, memberId, type }) => {
  const user = await client.user.findUnique({
    where: { id: memberId },
    select: { pk: true },
  });

  const data = toData("update:member", { userPk: user.pk, type });

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

    message.attachments = files;
  }

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

    message.attachments = files;
  }

  return toEntity("Message", message);
};

const findChat = async (filter) => {
  const chat = await client.chat.findFirst({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { ...filter?.where },
    include: { ...field.default, ...filter.include },
  });

  return toEntity("Chat", chat);
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
  const chat = await client.chat.findUnique({
    where: { id: chatId },
    select: { pk: true },
  });

  const message = await client.message.findUnique({
    where: {
      id: messageId,
      chatPk: chat.pk,
    },
    include: field.message,
  });

  return toEntity("Message", message);
};

const findChatMemberById = async (chatId, userId) => {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { pk: true },
  });

  if (!user) return null;

  const chat = await client.chat.findUnique({
    where: { id: chatId },
    select: { pk: true },
  });

  const member = await client.userOnChat.findUnique({
    where: {
      userPk_chatPk: {
        userPk: user.pk,
        chatPk: chat.pk,
      },
    },
    include: field.userOnChat,
  });

  return toEntity("Member", member);
};

const findChats = async (filter) => {
  const chats = await client.chat.findMany({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { ...filter?.where },
    include: {
      ...field.default,
    },
  });

  return chats?.map?.((chat) => toEntity("Chat", chat));
};

const findChatsByMemberId = async (memberId) => {
  const userOnChats = await client.userOnChat.findMany({
    where: {
      user: {
        id: memberId,
      },
    },
    select: {
      chat: {
        include: field.default,
      },
    },
  });

  return userOnChats?.map?.(({ chat }) => toEntity("Chat", chat));
};

const findChatMemberCountById = async (id) =>
  client.userOnChat.count({
    where: {
      chat: { id },
    },
  });

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

  const cursorItem = userOnChats?.find?.(
    ({ user }) => user.id === filter?.cursor?.id
  );

  if (cursorItem) {
    filterRef.cursor.id = cursorItem.id;
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

const findUserMessagesById = async (id) => {
  const messages = await client.message.findMany({
    where: { user: { id } },
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
    include: field.default,
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

const updateMembermutedUntil = async (
  chatId,
  { memberId, mutedUntil, chatType }
) => {
  const userOnChat = await client.userOnChat.findFirst({
    where: {
      chat: { id: chatId },
      user: { id: memberId },
    },
    select: { id: true },
  });

  const userOnChatId = userOnChat.id;

  const data = toData("update:member:mutedUntil", {
    mutedUntil,
    type: chatType,
  });

  const member = await client.userOnChat.update({
    data,
    where: {
      id: userOnChatId,
    },
    include: field.userOnChat,
  });

  return toEntity("Member", member);
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
  const chat = await client.chat.findUnique({
    where: { id: chatId },
    select: { pk: true },
  });

  const [message, deletedUser] = await client.$transaction([
    client.message.delete({
      where: {
        id: messageId,
        chatPk: chat.pk,
      },
      include: field.message,
    }),
    client.user.upsert({
      where: { username: "DELETED USER" },
      update: {},
      create: { username: "DELETED USER" },
    }),
  ]);

  const replyIds = message.replies.map((reply) => reply.id);

  await client.$transaction(async (tx) => {
    let msg = await tx.message.findFirst({
      where: {
        userPk: deletedUser.pk,
        content: "Original message was deleted",
      },
      select: { pk: true },
    });

    if (!msg) {
      msg = await tx.message.create({
        data: {
          content: "Original message was deleted",
          userPk: deletedUser.pk,
          deletedAt: new Date(),
        },
        select: { pk: true },
      });
    }

    await tx.message.updateMany({
      where: {
        id: { in: replyIds },
      },
      data: {
        replyToPk: msg.pk,
      },
    });

    return msg;
  });

  return toEntity("Message", message);
};

export default {
  transaction,
  insertDirectChat,
  insertGroupChat,
  insertMember,
  insertMessage,
  insertReply,
  findChat,
  findChatById,
  findChatMessageById,
  findChatMemberById,
  findChats,
  findChatsByMemberId,
  findChatMemberCountById,
  findChatMembersById,
  findChatMessagesById,
  findUserMessagesById,
  updateChatNameById,
  updateChatAvatar,
  updateMessageDeletedAt,
  updateMembermutedUntil,
  deleteChatById,
  revokeMembership,
  deleteMessageById,
};
