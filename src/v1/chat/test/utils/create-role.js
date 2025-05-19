import client from "../../../../db/client.js";

const createRole = async (name, roleLevel, chatId, permissions = []) => {
  const data = {
    name,
    roleLevel,
    isDefaultRole: false,
    chat: { connect: { id: chatId } },
  };

  if (permissions.length) {
    data.permissions = { connect: permissions.map((perm) => ({ name: perm })) };
  }

  return client.role.create({
    data,
  });
};

export default createRole;
