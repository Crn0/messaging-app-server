import client from "../../db/client.js";
import field from "./include.js";
import { toData, toEntity } from "./role-mapper.js";

const insert = async ({ chatId, name, isDefaultRole, permissions }) => {
  const roleLevel =
    (await client.role.count({
      where: { isDefaultRole: false, chat: { id: chatId } },
    })) + 1;

  const data = toData("insert", {
    chatId,
    name,
    roleLevel,
    isDefaultRole,
    permissions,
  });

  const role = await client.role.create({
    data,
    include: field.default,
  });

  return toEntity(role);
};

const insertWithTransaction = async ({
  chatId,
  name,
  isDefaultRole,
  permissions,
}) => {
  const transaction = await client.$transaction(async (tx) => {
    const chat = await tx.chat.findUnique({
      where: { id: chatId },
      select: { pk: true },
    });

    const [{ last_level: lastLevel }] = await tx.$queryRawUnsafe(
      'UPDATE "ChatRoleCounters" SET last_level = last_level + 1 WHERE chat_pk = $1 RETURNING last_level',
      chat.pk
    );

    const roleLevel = lastLevel;

    const data = toData("insert", {
      chatId,
      name,
      roleLevel,
      isDefaultRole,
      permissions,
    });

    const role = await tx.role.create({
      data,
      include: field.default,
    });

    return toEntity(role);
  });

  return transaction;
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

const updateChatRoleMetaData = async (roleId, { name, permissions }) => {
  const data = toData("update:metaData", { name, permissions });

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
  const [chat, member] = await client.$transaction([
    client.chat.findUnique({ where: { id: chatId }, select: { pk: true } }),
    client.user.findUnique({ where: { id: memberId }, select: { pk: true } }),
  ]);

  const userOnChat = await client.userOnChat.findFirst({
    where: {
      chatPk: chat.pk,
      userPk: member.pk,
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
  const [chat, members] = await client.$transaction([
    client.chat.findUnique({ where: { id: chatId }, select: { pk: true } }),
    client.user.findMany({
      where: { id: { in: memberIds } },
      select: { pk: true },
    }),
  ]);

  const memberPks = members.map(({ pk }) => pk);

  const userOnChats = await client.userOnChat.findMany({
    where: {
      chatPk: chat.pk,
      userPk: { in: memberPks },
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

const updateChatRoleRoleLevels = async (chatId, { roleIds }) => {
  let oldRoles;
  let rolesToUpdate;

  try {
    [oldRoles, rolesToUpdate] = await Promise.all([
      client.role.findMany({
        where: { chat: { id: chatId }, isDefaultRole: false },
      }),
      client.role.findMany({
        where: { id: { in: roleIds }, chat: { id: chatId } },
      }),
    ]);

    const roleLevels = rolesToUpdate.map((r) => r.roleLevel);
    const minRoleLevel = Math.min(...roleLevels);
    const maxRoleLevel = Math.max(...roleLevels);
    const rolesInRange = await client.role.findMany({
      orderBy: { roleLevel: "asc" },
      where: {
        chat: { id: chatId },
        id: { notIn: roleIds },
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
      roleIds.map((id, i) => {
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

const deleteChatRoleMemberById = async (roleId, chatId, memberId) => {
  const [chat, member] = await client.$transaction([
    client.chat.findUnique({ where: { id: chatId }, select: { pk: true } }),
    client.user.findUnique({ where: { id: memberId }, select: { pk: true } }),
  ]);

  const userOnChat = await client.userOnChat.findFirst({
    where: {
      chatPk: chat.pk,
      userPk: member.pk,
    },
    select: { id: true },
  });

  const data = toData("delete:member", { memberId: userOnChat.id });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
    },
    include: field.default,
  });
  return toEntity(role);
};

const deleteChatRoleById = async (roleId, chatId) => {
  const transaction = await client.$transaction(async (tx) => {
    const chat = await tx.chat.findUnique({
      where: { id: chatId },
      select: { pk: true },
    });

    const deletedRole = await tx.role.delete({
      where: {
        id: roleId,
        chat: {
          id: chatId,
        },
      },
      include: field.default,
    });

    const remainingRoles = await tx.role.findMany({
      orderBy: { roleLevel: "asc" },
      where: {
        chat: { id: chatId },
        isDefaultRole: false,
        NOT: { id: deletedRole.id },
      },
      select: {
        id: true,
      },
    });

    if (remainingRoles.length) {
      await Promise.all(
        remainingRoles.map(async (r, i) =>
          tx.role.update({
            where: { id: r.id },
            data: { roleLevel: i + 1 },
          })
        )
      );
    }

    await tx.$queryRawUnsafe(
      'UPDATE "ChatRoleCounters" SET last_level = $2 WHERE chat_pk = $1 RETURNING last_level',
      chat.pk,
      remainingRoles.length
    );

    return toEntity(deletedRole);
  });

  return transaction;
};

export default {
  insert,
  insertWithTransaction,
  findChatRoleById,
  findChatDefaultRolesById,
  findChatRolesById,
  findUserRolesById,
  updateChatRoleMetaData,
  updateChatRoleMember,
  updateChatRoleMembers,
  updateChatRoleRoleLevels,
  deleteChatRoleMemberById,
  deleteChatRoleById,
};
