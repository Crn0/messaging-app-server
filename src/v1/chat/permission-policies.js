import chatPolicy from "./chat-policy.js";
import memberPolicy from "./member-policy.js";
import rolePolicy from "./role-policy.js";
import messagePolicy from "./message-policy.js";

export default {
  chat: chatPolicy,
  member: memberPolicy,
  role: rolePolicy,
  message: messagePolicy,
};
