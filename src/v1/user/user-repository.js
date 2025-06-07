import client from "../../db/client.js";
import { toData, toEntity } from "./user-mapper.js";
import field from "./include.js";

const createUser = async ({
  username,
  email,
  displayName,
  password,
  accountLevel,
}) => {
  const data = toData("insert", {
    username,
    email,
    displayName,
    password,
    accountLevel,
  });
  const include = { ...field.default };

  const user = await client.user.create({ data, include });

  return toEntity(user);
};

const findMeById = async (id) => {
  const include = { ...field.me };

  const user = await client.user.findUnique({
    include,
    where: {
      id,
    },
  });

  return toEntity(user);
};

const findUserById = async (id) => {
  const include = { ...field.default };

  const user = await client.user.findUnique({
    include,
    where: {
      id,
    },
  });

  return toEntity(user);
};

const findUserByUsername = async (username) => {
  const include = { ...field.default };

  const user = await client.user.findUnique({
    include,
    where: {
      username,
    },
  });

  return toEntity(user);
};

const findUserByEmail = async (email) => {
  const include = { ...field.default };

  const user = await client.user.findUnique({
    include,
    where: {
      email,
    },
  });

  return toEntity(user);
};

const findUserPkById = async (id) => {
  const user = await client.user.findUnique({
    where: { id },
    select: { pk: true },
  });

  return user?.pk ?? null;
};

const findUsersPkById = async (userIds) => {
  const users = await client.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: { pk: true },
  });

  return users.map((user) => user.pk);
};

const findUserOwnedChatsById = async (id) => {
  const user = await client.user.findUnique({
    where: {
      id,
    },
    select: {
      ownedChats: { select: { id: true } },
    },
  });

  return user.ownedChats;
};

const updateUsernameById = async (id, username) => {
  const include = { ...field.default };

  const user = await client.user.update({
    include,
    where: {
      id,
    },
    data: { username, updatedAt: new Date() },
  });

  return toEntity(user);
};

const updateEmailById = async (id, email) => {
  const include = { ...field.default };

  const user = await client.user.update({
    include,
    where: {
      id,
    },
    data: { email, updatedAt: new Date() },
  });

  return toEntity(user);
};

const updatePasswordById = async (id, password) => {
  const include = { ...field.default };

  const user = await client.user.update({
    include,
    where: {
      id,
    },
    data: { password, updatedAt: new Date() },
  });

  return toEntity(user);
};

const deleteUserById = async (id) => {
  const include = { ...field.default };

  const user = await client.user.delete({
    include,
    where: {
      id,
    },
  });

  return toEntity(user);
};

const deleteUsers = async () => client.user.deleteMany({});

export default {
  createUser,
  findMeById,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findUserPkById,
  findUsersPkById,
  findUserOwnedChatsById,
  updateUsernameById,
  updateEmailById,
  updatePasswordById,
  deleteUserById,
  deleteUsers,
};
