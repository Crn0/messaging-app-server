import client from "../../../../../db/client.js";

const clearDb = async () => {
  await client.$transaction([client.user.deleteMany({})]);
};

export default {
  clearDb,
};
