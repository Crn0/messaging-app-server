import client from "../../db/client.js";
import field from "./include.js";
import { toData, toEntity } from "./role-mapper.js";

const insert = async ({ chatId, name, isDefaultRole, permissionIds }) => {
  const roleLevel =
    (await client.role.count({
      where: { isDefaultRole: false, chat: { id: chatId } },
    })) + 1;

  const data = toData("insert", {
    chatId,
    name,
    roleLevel,
    isDefaultRole,
    permissionIds,
  });

  const role = await client.role.create({
    data,
    include: field.default,
  });

  return toEntity(role);
};

const findChatRoleById = async (roleId, chatId) => {
  const role = await client.role.findFirst({
    where: { id: roleId, chat: { id: chatId } },
    include: field.default,
  });

  return toEntity(role);
};

const findChatDefaultRolesById = async (chatId) => {
  const roles = await client.role.findMany({
    where: { isDefaultRole: true, chat: { id: chatId } },
    include: field.default,
  });

  return roles.map(toEntity);
};

const findChatRolesById = async (chatId) => {
  const roles = await client.role.findMany({
    orderBy: {
      roleLevel: "asc",
    },
    where: { chat: { id: chatId } },
    include: field.default,
  });

  return roles.map(toEntity);
};

const findUserRolesById = async (chatId, userId) => {
  const user = await client.userOnChat.findFirst({
    where: {
      chat: {
        id: chatId,
      },
      user: {
        id: userId,
      },
    },
    select: {
      roles: field.roles,
    },
  });

  return user?.roles?.map?.(toEntity) ?? [];
};

const updateChatRoleMetaData = async (roleId, { name, permissionIds }) => {
  const data = toData("update:metaData", { name, permissionIds });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
    },
    include: field.default,
  });

  return toEntity(role);
};

const updateChatRoleMember = async (roleId, chatId, { memberId }) => {
  const userOnChat = await client.userOnChat.findFirst({
    where: {
      chat: {
        id: chatId,
      },
      user: {
        id: memberId,
      },
    },
    select: {
      id: true,
    },
  });

  const userOnChatId = userOnChat.id;

  const data = toData("update:member", { memberId: userOnChatId });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
    },
    include: field.default,
  });

  return toEntity(role);
};

const updateChatRoleMembers = async (roleId, chatId, { memberIds }) => {
  const userOnChats = await client.userOnChat.findMany({
    where: {
      chat: {
        id: chatId,
      },
      user: {
        id: { in: memberIds },
      },
    },
    select: {
      id: true,
    },
  });

  const userOnChatsId = userOnChats.map(({ id }) => id);

  const data = toData("update:members", { memberIds: userOnChatsId });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
    },
    include: field.default,
  });

  return toEntity(role);
};

const updateChatRolesRoleLevel = async (chatId, { rolesId }) => {
  let oldRoles;
  let rolesToUpdate;

  try {
    [oldRoles, rolesToUpdate] = await Promise.all([
      client.role.findMany({
        where: { chat: { id: chatId }, isDefaultRole: false },
      }),
      client.role.findMany({
        where: { id: { in: rolesId }, chat: { id: chatId } },
      }),
    ]);

    const roleLevels = rolesToUpdate.map((r) => r.roleLevel);
    const minRoleLevel = Math.min(...roleLevels);
    const maxRoleLevel = Math.max(...roleLevels);
    const rolesInRange = await client.role.findMany({
      orderBy: { roleLevel: "asc" },
      where: {
        chat: { id: chatId },
        id: { notIn: rolesId },
        roleLevel: {
          gt: minRoleLevel,
          lt: maxRoleLevel,
        },
      },
      select: {
        id: true,
        roleLevel: true,
      },
    });

    await client.role.updateMany({
      where: {
        chat: { id: chatId },
        roleLevel: {
          gte: minRoleLevel,
          lte: maxRoleLevel,
        },
      },
      data: {
        roleLevel: null,
      },
    });

    let roleLevelCounter = minRoleLevel + rolesToUpdate.length;

    await Promise.all(
      rolesInRange.map(async (role) => {
        const currentRoleLevel = roleLevelCounter;

        roleLevelCounter += 1;

        return client.role.update({
          where: {
            id: role.id,
          },
          data: {
            roleLevel: currentRoleLevel,
          },
        });
      })
    );

    const roles = await client.$transaction(
      rolesId.map((id, i) => {
        const data = toData("update:roleLevel", {
          roleLevel: minRoleLevel + i,
        });
        return client.role.update({
          data,
          where: {
            id,
          },
          include: field.default,
        });
      })
    );

    return roles.sort((a, b) => a.roleLevel - b.roleLevel).map(toEntity);
  } catch (e) {
    await Promise.all(
      oldRoles.map(async (role) =>
        client.role.update({
          where: {
            id: role.id,
          },
          data: {
            roleLevel: role.roleLevel,
            updatedAt: role.updatedAt,
          },
        })
      )
    );

    throw e;
  }
};

const deleteChatRoleById = async (roleId, chatId) => {
  const role = await client.role.delete({
    where: {
      id: roleId,
      chat: {
        id: chatId,
      },
    },
    include: field.default,
  });

  return toEntity(role);
};

export default {
  insert,
  findChatRoleById,
  findChatDefaultRolesById,
  findChatRolesById,
  findUserRolesById,
  updateChatRoleMetaData,
  updateChatRoleMember,
  updateChatRoleMembers,
  updateChatRolesRoleLevel,
  deleteChatRoleById,
};
