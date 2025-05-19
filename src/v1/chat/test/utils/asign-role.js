import client from "../../../../db/client.js";

const assignRolesToUser = async (userOnChatId, roleIds) =>
  client.userOnChat.update({
    where: { id: userOnChatId },
    data: {
      roles: {
        connect: Array.isArray(roleIds)
          ? roleIds.map((id) => ({ id }))
          : [{ id: roleIds }],
      },
    },
  });

export default assignRolesToUser;
