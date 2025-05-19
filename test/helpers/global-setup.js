import client from "../../src/db/client.js";

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
  await client.permission.createMany({
    data: permissions.map((name) => ({ name })),
    skipDuplicates: true,
  });

  return async () => {
    if (teardownHappened) {
      throw new Error("teardown called twice");
    }

    teardownHappened = true;

    client.$transaction([
      client.permission.deleteMany(),
      client.message.deleteMany(),
      client.attachment.deleteMany(),
      client.chat.deleteMany(),
      client.user.deleteMany(),
    ]);
  };
};
