import client from "../../db/client.js";
import field from "./include.js";
import { toData, toEntity } from "./role-mapper.js";

const insert = async ({ chatId, name, isDefaultRole, permissionIds }) => {
  const roleLevel = (await client.role.count()) + 1;

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
  const role = await client.role.findUnique({
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

const updateChatRoleDisplay = async ({ roleId, chatId, name }) => {
  const data = toData("update:display", { name });

  const role = await client.role.update({
    data,
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

const updateChatRolePermissions = async ({ roleId, chatId, permissionIds }) => {
  const data = toData("update:permissions", { permissionIds });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
      chat: { id: chatId },
    },
    include: field.default,
  });

  return toEntity(role);
};

const updateChatRoleMembers = async ({ roleId, chatId, membersId }) => {
  const userOnChats = await client.userOnChat.findMany({
    where: {
      chat: {
        id: chatId,
      },
      user: {
        id: { in: membersId },
      },
    },
    select: {
      id: true,
    },
  });

  const userOnChatsId = userOnChats.map(({ id }) => id);

  const data = toData("update:members", { membersId: userOnChatsId });

  const role = await client.role.update({
    data,
    where: {
      id: roleId,
      chat: { id: chatId },
    },
    include: field.default,
  });

  return toEntity(role);
};

const updateChatRolesRoleLevel = async ({ chatId, rolesId }) => {
  await client.role.updateMany({
    where: {
      chat: { id: chatId },
    },
    data: {
      roleLevel: null,
    },
  });

  const roles = await client.$transaction(
    rolesId.map((id, index) => {
      const data = toData("update:roleLevel", { roleLevel: index + 1 });

      return client.role.update({
        data,
        where: {
          id,
          chat: { id: chatId },
        },
        include: field.default,
      });
    })
  );

  return roles.sort((a, b) => a.roleLevel - b.roleLevel).map(toEntity);
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
  updateChatRoleDisplay,
  updateChatRolePermissions,
  updateChatRoleMembers,
  updateChatRolesRoleLevel,
  deleteChatRoleById,
};
