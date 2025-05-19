import client from "../../../../db/client.js";

const findUserOnChat = async (chatId, userId) =>
  client.userOnChat.findFirst({
    where: { chat: { id: chatId }, user: { id: userId } },
    select: { id: true },
  });

export default findUserOnChat;
