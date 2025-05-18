import client from "../../src/db/client.js";

const cleanup = async () => {
  try {
    await client
      .$transaction([
        client.permission.deleteMany(),
        client.message.deleteMany(),
        client.attachment.deleteMany(),
        client.chat.deleteMany(),
        client.user.deleteMany(),
      ])
      .then(console.log);
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await client.$disconnect();
  }
};

cleanup();
