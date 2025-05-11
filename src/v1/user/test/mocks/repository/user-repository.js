import { v7 as uuidv7 } from "uuid";
import db from "../db/index.js";
import { toEntity } from "../../../user-mapper.js";

let pkCount = 0;

const dbClear = () => {
  db.clear();
  pkCount = 0;
};

const createUser = async ({
  username,
  email,
  displayName,
  password,
  accountLevel,
}) => {
  const id = uuidv7();
  // eslint-disable-next-line no-multi-assign
  const pk = (pkCount += 1);
  const createdAt = new Date();
  const updatedAt = null;
  const lastSeenAt = null;

  const user = {
    pk,
    id,
    email,
    username,
    displayName,
    password,
    createdAt,
    updatedAt,
    lastSeenAt,
    accountLevel,
  };

  db.set(pk, user);
  db.set(id, user);
  db.set(username, user);
  db.set(email, user);

  return user;
};

const findUserByUsername = async (username) => {
  const user = db.get(username);

  return toEntity(user);
};

const findUserPkById = async (id) => {
  const user = db.get(id);

  return user?.pk;
};

const findMeById = async (id, query) => {
  const user = db.get(id);

  query?.forEach?.((q) => {
    user[q] = [];
  });

  return toEntity(user);
};

const findUserById = async (id) => {
  const user = db.get(id);

  return toEntity(user);
};

const findUserByEmail = async (email) => {
  const user = db.get(email);

  return toEntity(user);
};

const findUsersPkById = async (userIds) => {
  const users = [];

  db.forEach((value, key) => {
    if (userIds.includes(key)) {
      users.push(value);
    }
  });

  return users.map((user) => user.pk);
};

const updateUsernameById = async (id, username) => {
  const oldUser = db.get(id);

  const updatedUser = { ...oldUser, username, updatedAt: new Date() };

  db.set(updatedUser.pk, updatedUser);
  db.set(updatedUser.id, updatedUser);
  db.set(updatedUser.username, updatedUser);
  db.set(updatedUser.email, updatedUser);

  return updatedUser;
};

const updateEmailById = async (id, email) => {
  const oldUser = db.get(id);

  const updatedUser = { ...oldUser, email, updatedAt: new Date() };

  db.set(updatedUser.pk, updatedUser);
  db.set(updatedUser.id, updatedUser);
  db.set(updatedUser.username, updatedUser);
  db.set(updatedUser.email, updatedUser);

  return updatedUser;
};

const updatePasswordById = async (id, password) => {
  const oldUser = db.get(id);

  const updatedUser = { ...oldUser, password, updatedAt: new Date() };

  db.set(updatedUser.pk, updatedUser);
  db.set(updatedUser.id, updatedUser);
  db.set(updatedUser.username, updatedUser);
  db.set(updatedUser.email, updatedUser);

  return updatedUser;
};

const deleteUserById = async (id) => {
  const oldUser = db.get(id);

  db.delete(oldUser.pk);
  db.delete(oldUser.id);
  db.delete(oldUser.username);
  db.delete(oldUser.email);

  return toEntity(oldUser);
};

const deleteUsers = async () => {
  dbClear();

  return { count: null };
};

export default {
  createUser,
  findUserByUsername,
  findUserPkById,
  findMeById,
  findUserById,
  findUserByEmail,
  findUsersPkById,
  updateUsernameById,
  updateEmailById,
  updatePasswordById,
  deleteUserById,
  deleteUsers,
};

export { dbClear };
