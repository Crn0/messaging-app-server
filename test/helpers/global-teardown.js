import client from "../../src/db/client.js";

export default async () => {
  await client.$transaction([
    client.permission.deleteMany(),
    client.message.deleteMany(),
    client.attachment.deleteMany(),
    client.chat.deleteMany(),
    client.user.deleteMany(),
  ]);
};
