import { readFile } from "fs/promises";
import { join } from "path";

import client from "./client.js";
import { hashPassword } from "../v1/helpers/index.js";

const readAndParse = async (path) =>
  JSON.parse(await readFile(join(import.meta.dirname, path)));

const createPermissions = async (permissions) =>
  client.permission.createMany({ data: permissions });

const createUsers = async (users) => {
  const userDatas = await Promise.all(
    users.map(async ({ username, password, accountLevel }) => ({
      username,
      accountLevel,
      password: password ? await hashPassword(password) : null,
    }))
  );

  const createdUsers = await client.user.createManyAndReturn({
    data: userDatas,
  });

  const userProfiles = users.map(({ username, profile }) => ({
    ...profile,
    userPk: createdUsers.find((u) => u.username === username).pk,
  }));

  await client.profile.createManyAndReturn({
    data: userProfiles,
  });
};

const createDeletedMessage = async () =>
  client.message.create({
    data: {
      content: "Original message was deleted",
      user: { connect: { username: "DELETED USER" } },
    },
  });

const main = async () => {
  const [permissions, users] = await Promise.all([
    readAndParse("data/permissions.json"),
    readAndParse("data/users.json"),
  ]);

  await Promise.all([
    createPermissions(permissions.map((name) => ({ name }))),
    createUsers(users),
  ]);

  await createDeletedMessage();
};

main();
