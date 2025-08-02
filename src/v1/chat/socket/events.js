export const CHAT_NAMESPACE = "/chats";

export const CHAT_JOIN = "join:chat";
export const CHAT_LEAVE = "leave:chat";

export const CHAT_ROOM = (chatId) => `chat:${chatId}`;
export const CHAT_MESSAGES = (chatId) => `view:chat:${chatId}:messages`;

export const getChatNamespace = () => "namespace:V1:chat";
