import client from "../../../db/client.js";
import { toData, toEntity } from "./open-id-mapper.js";

const insert = async ({ provider, token, sub, email, username }) => {
  const data = toData({ provider, token, sub, email, username });
  const include = { user: true };

  const openId = await client.openID.create({
    data,
    include,
  });

  return toEntity(openId);
};

const findOpenIdByProviderAndSub = async (provider, sub) => {
  const include = { user: true };

  const openId = await client.openID.findUnique({
    include,
    where: {
      provider_sub: {
        provider,
        sub,
      },
    },
  });

  return toEntity(openId);
};

const findOpenIdByProviderAndUserPk = async (provider, userPk) => {
  const include = { user: true };

  const openId = await client.openID.findUnique({
    include,
    where: {
      provider_userPk: {
        provider,
        userPk,
      },
    },
  });

  return toEntity(openId);
};

const deleteOpenId = async ({ provider, userPk }) => {
  const openId = await client.openID.delete({
    where: {
      provider_userPk: {
        provider,
        userPk,
      },
    },
  });

  return openId;
};

export default {
  insert,
  findOpenIdByProviderAndSub,
  findOpenIdByProviderAndUserPk,
  deleteOpenId,
};
