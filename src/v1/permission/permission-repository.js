import client from "../../db/client.js";
import { toData, toEntity } from "./permission-mapper.js";

const insert = async ({ name }) => {
  const data = toData("insert", { name });

  const permission = await client.permission.create({ data });

  return toEntity(permission);
};

const findPermissionById = async (id) => {
  const permission = await client.permission.findUnique({
    where: { id },
  });

  return toEntity(permission);
};

const findPermissionByName = async (name) => {
  const permission = await client.permission.findUnique({
    where: { name },
  });

  return toEntity(permission);
};

const findPermissions = async (filter) => {
  const permissions = await client.permission.findMany({
    take: filter?.take,
    skip: filter?.skip,
    cursor: filter?.cursor,
    orderBy: filter?.orderBy,
    where: { ...filter?.where },
  });

  return permissions.map(toEntity);
};

const updatePermissionNameById = async (id, name) => {
  const data = toData("update:name", { name });

  const permission = await client.permission.update({
    where: { id },
    data,
  });

  return toEntity(permission);
};

const deletePermissionById = async (id) => {
  const permission = await client.permission.delete({ where: { id } });

  return toEntity(permission);
};

const deletePermissionByName = async (name) => {
  const permission = await client.permission.delete({ where: { name } });

  return toEntity(permission);
};

export default {
  insert,
  findPermissionById,
  findPermissionByName,
  findPermissions,
  updatePermissionNameById,
  deletePermissionById,
  deletePermissionByName,
};
