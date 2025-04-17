import client from "../../../db/client.js";
import { toData } from "./token-mapper.js";

const insert = async (id, expiresIn, type, userId) => {
  const data = toData({ id, expiresIn, type, userId });

  const token = await client.token.create({ data });

  return token;
};

const getTokenById = async (id, type) => {
  const token = await client.token.findUnique({ where: { id, type } });

  return token;
};

const deleteExpiredTokens = async () => {
  const tokens = await client.token.deleteMany({
    where: {
      expiresIn: {
        gte: new Date(),
      },
    },
  });

  return tokens;
};

export default { insert, getTokenById, deleteExpiredTokens };
