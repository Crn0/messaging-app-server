import { join } from "path";
import { readdir, unlink } from "fs/promises";
import client from "../../src/db/client.js";

const dirname = import.meta?.dirname;

const removeTempImages = async (path) => {
  const dir = await readdir(path);

  await Promise.all(
    dir.map(async (fileName) => {
      const filePath = `${path}/${fileName}`;

      if (fileName === ".gitkeep") return;

      await unlink(filePath);
    })
  );
};

const permissions = [
  // GENERAL SERVER PERMISSIONS
  "manage_role",
  "manage_chat",
  "view_chat",
  // MEMBERSHIP PERMISSIONS
  "create_invite",
  "manage_member",
  "kick_member",
  "mute_member",
  // TEXT PERMISSIONS
  "send_message",
  "manage_message",
  // ADVANCED PERMISSIONS
  "admin",
];

let teardownHappened = false;

export default async () => {
  await client.$transaction([
    client.permission.createMany({
      data: permissions.map((name) => ({ name })),
      skipDuplicates: true,
    }),
    client.user.create({
      data: {
        username: "DELETED USER",
      },
    }),
  ]);

  return async () => {
    if (teardownHappened) {
      throw new Error("teardown called twice");
    }

    teardownHappened = true;

    const uploadPath = join(dirname, "..", "..", "src", "temp", "upload");

    await removeTempImages(uploadPath);

    await client.$transaction([
      client.permission.deleteMany(),
      client.message.deleteMany(),
      client.attachment.deleteMany(),
      client.chat.deleteMany(),
      client.user.deleteMany(),
    ]);
  };
};
