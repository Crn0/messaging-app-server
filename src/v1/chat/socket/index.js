import { CHAT_NAMESPACE, CHAT_JOIN, CHAT_LEAVE } from "./events.js";

import { handleJoinChat, handleLeaveChat } from "./handlers.js";

import { Debug } from "../../lib/index.js";

const debug = Debug("socket:chats");

export default function registerChatNamespace(io) {
  const chatNamespace = io.of(CHAT_NAMESPACE);

  chatNamespace.on("connection", (socket) => {
    debug(`user ${socket.id} connected to ${CHAT_NAMESPACE}`);

    socket.on(CHAT_JOIN, (chatId) => handleJoinChat(socket, chatId));
    socket.on(CHAT_LEAVE, (chatId) => handleLeaveChat(socket, chatId));

    socket.on("disconnect", () => {
      debug(`user ${socket.id} disconnected to ${CHAT_NAMESPACE}`);
    });
  });

  return chatNamespace;
}
