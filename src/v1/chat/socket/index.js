import { Debug } from "../../lib/index.js";

import { CHAT_NAMESPACE, CHAT_JOIN, CHAT_LEAVE } from "./events.js";

import { handleJoinChat, handleLeaveChat } from "./handlers.js";

import createJwtUtils from "../../auth/jwt.js";
import { createSocketAccessTokenMiddleware } from "../../auth/auth-middleware.js";
import { idGenerator } from "../../auth/utils.js";

const debug = Debug("socket:chats");

const jwtUtils = createJwtUtils({
  secret: process.env.NODE_ENV === "prod" ? process.env.JWT_SECRET : "secret",
  idGenerator,
});

export default function registerChatNamespace(io) {
  const chatNamespace = io.of(CHAT_NAMESPACE);

  chatNamespace.use(createSocketAccessTokenMiddleware({ jwtUtils }));

  chatNamespace.on("connection", (socket) => {
    debug(`user ${socket.id} connected to ${CHAT_NAMESPACE}`);

    debug("socket auth user:", socket?.data.user);

    socket.on(CHAT_JOIN, (chatId) => handleJoinChat(socket, chatId));
    socket.on(CHAT_LEAVE, (chatId) => handleLeaveChat(socket, chatId));

    socket.on("disconnect", () => {
      debug(`user ${socket.id} disconnected to ${CHAT_NAMESPACE}`);
    });
  });

  return chatNamespace;
}
