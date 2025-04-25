import db from "../../db/index.js";
import { idGenerator } from "../../../utils.js";

const insertDirectChat = ({ chatId, membersId }) => {
  const id = chatId;
  const type = "DirectChat";
  const isPrivate = true;
  const createdAt = new Date();

  const data = {
    id,
    type,
    isPrivate,
    createdAt,
    name: null,
    avatar: null,
    members: membersId,
    messages: [],
  };

  db.set(id, data);

  delete data.members;

  return data;
};

const insertGroupChat = ({ chatId, name, ownerId, isPrivate }) => {
  const id = chatId;
  const type = "GroupChat";
  const createdAt = new Date();
  const updatedAt = null;

  const data = {
    id,
    ownerId,
    type,
    isPrivate,
    createdAt,
    updatedAt,
    name: name ?? null,
    avatar: null,
    members: [ownerId],
    messages: [],
  };

  db.set(id, data);

  return data;
};

const insertMember = async ({ chatId, memberId }) => {
  const oldChat = db.get(chatId);
  const data = {
    ...oldChat,
    members: oldChat.members.concat(memberId),
  };

  db.set(chatId, data);

  return data;
};

const insertMessage = async ({ chatId, senderId, content }) => {
  const oldChat = db.get(chatId);
  const id = idGenerator();

  const message = {
    id,
    chatId,
    content,
    userId: senderId,
    createdAt: new Date(),
    replyTo: null,
    attachments: null,
    replies: [],
  };
  const data = {
    ...oldChat,
    messages: oldChat.messages.concat(message),
  };

  db.set(chatId, data);

  return message;
};

const insertReply = async ({
  chatId,
  senderId,
  messageId,
  content,
  attachments,
}) => {
  const oldChat = db.get(chatId);
  const id = idGenerator();

  const messageData = {
    id,
    chatId,
    messageId,
    content,
    userId: senderId,
    createdAt: new Date(),
    replyTo: { id: messageId },
    replies: [],
    attachments: null,
  };

  const data = {
    ...oldChat,
    messages: oldChat.messages
      .concat(messageData)
      .map((message) =>
        message.id === messageId
          ? { ...message, replies: message.replies.concat(messageData) }
          : message
      ),
  };

  db.set(chatId, data);

  return messageData;
};
const findChatById = async (id) => db.get(id);

const findChatMemberById = async (chatId, userId) => {
  const chat = db.get(chatId);
  const member = chat.members.reduce((result, nextId) =>
    result === userId ? { id: result } : nextId
  );

  return member;
};

const findChatMessageById = async (chatId, messageId) => {
  const chat = db.get(chatId);

  const message = chat.messages.reduce((result, next, i, arr) => {
    if (
      i === arr.length - 1 &&
      next.id !== messageId &&
      result.id !== messageId
    ) {
      return null;
    }
    if (result.id === messageId) return result;

    return next;
  }, {});

  return message;
};

const findChats = async (type, filter) => {
  const chats = Array.from(db, ([_, value]) => ({ ...value }))
    .filter((chat) => chat.type === type)
    .sort((a, b) => {
      if (filter?.take > 0) return b - a;

      return a - b;
    });

  return filter?.take > 0 ? chats.slice(0, filter.take) : chats.slice(0, 1);
};

const findChatMembersById = async (id, filter) => {
  const chat = db.get(id);

  const members = chat.members
    .map((memberId) => ({ id: memberId }))
    .sort((a, b) => {
      if (filter?.take > 0) return b - a;

      return a - b;
    });

  return filter?.take > 0 ? members.slice(0, filter.take) : members.slice(0, 1);
};

const findChatMessagesById = async (id, filter) => {
  const chat = db.get(id);

  const messages = chat.messages.sort((a, b) => {
    if (filter?.take > 0) return b - a;

    return a - b;
  });

  return filter?.take > 0
    ? messages.slice(0, filter.take)
    : messages.slice(0, 1);
};

const updateChatNameById = async ({ chatId, name }) => {
  const chat = db.get(chatId);

  const data = {
    ...chat,
    name,
    updatedAt: new Date(),
  };

  db.set(chatId, data);

  return data;
};

const updateChatAvatar = async ({ chatId, attachment }) => {
  const chat = db.get(chatId);

  const data = {
    ...chat,
    avatar: {
      ...attachment,
      updatedAt: new Date(),
      type: "Image",
    },
    updatedAt: new Date(),
  };

  db.set(chatId, data);

  return data;
};

const revokeMembership = async ({ chatId, memberId }) => {
  const chat = db.get(chatId);

  const data = {
    ...chat,
    members: chat.members.filter((member) => member !== memberId),
  };

  db.set(chatId, data);

  return data;
};

const deleteChatById = async (id) => {
  const chat = db.get(id);

  db.delete(id);

  return chat;
};

const deleteMessageById = async (chatId, messageId) => {
  const chat = db.get(chatId);

  const data = {
    ...chat,
    messages: chat.messages.filter((message) => message.id !== messageId),
  };

  db.set(chatId, data);

  const message = chat.messages.reduce((result, next) => {
    if (result.id === messageId) return result;

    return next;
  });

  return message;
};

export default {
  insertDirectChat,
  insertGroupChat,
  insertMember,
  insertMessage,
  insertReply,
  findChatById,
  findChatMemberById,
  findChatMessageById,
  findChats,
  findChatMembersById,
  findChatMessagesById,
  updateChatNameById,
  updateChatAvatar,
  revokeMembership,
  deleteChatById,
  deleteMessageById,
};
