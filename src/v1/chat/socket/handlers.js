import { Debug } from "../../lib/index.js";
import { tryCatchAsync as tryCatch } from "../../helpers/index.js";
import { CHAT_ROOM } from "./events.js";

const debug = Debug("socket:chats:handlers");

export const handleJoinChat = async (socket, chatId) => {
  const { error } = await tryCatch(socket.join(CHAT_ROOM(chatId)));

  debug(`user connected to chat ${chatId}`);

  if (error) {
    debug(`Failed to join chat ${chatId}:`, error);
  }
};

export const handleLeaveChat = async (socket, chatId) => {
  const { error } = await tryCatch(socket.leave(CHAT_ROOM(chatId)));

  debug(`user disconnected to chat ${chatId}`);

  if (error) {
    debug(`Failed to leave chat ${chatId}:`, error);
  }
};
