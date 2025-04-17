import { httpStatus } from "../../../constants/index.js";
import APIError from "../../../errors/api-error.js";
import Debug from "./debug.js";

const debug = Debug.extend("service");

const unlinkGoogle = async (token) => {
  debug("Requesting google to remove tokenId");
  debug(`tokenId: ${token}`);
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  if (!res.ok) {
    debug("Request to revoke googles access token: unsuccessful");
    debug(await res.json());
  } else {
    debug("Request to revoke googles access token: successful");
  }
};

const createInsertOpenId =
  ({ openIdRepository }) =>
  async (data) => {
    const openId = await openIdRepository.insert(data);

    return openId;
  };

const createGetOpenIdByProviderAndSub =
  ({ openIdRepository }) =>
  async (provider, sub) => {
    const openId = await openIdRepository.findOpenIdByProviderAndSub(
      provider,
      sub
    );

    return openId;
  };

const createGetOpenIdByProviderAndUserId =
  ({ openIdRepository, userService }) =>
  async (provider, userId) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User does not exist", httpStatus.NOT_FOUND);
    }

    const openId = await openIdRepository.findOpenIdByProviderAndUserPk(
      provider,
      userPk
    );

    return openId;
  };

const createDeleteOpenId =
  ({ openIdRepository, userService }) =>
  async ({ provider, userId }) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User does not exist", httpStatus.NOT_FOUND);
    }

    const data = { provider, userPk };

    const openId = await openIdRepository.deleteOpenId(data);

    if (provider === "google") {
      await unlinkGoogle(openId.token);
    }

    return openId;
  };

export default (dependencies) => {
  const createOpenId = createInsertOpenId(dependencies);

  const getOpenIdByProviderAndSub =
    createGetOpenIdByProviderAndSub(dependencies);
  const getOpenIdByProviderAndUserId =
    createGetOpenIdByProviderAndUserId(dependencies);

  const deleteOpenId = createDeleteOpenId(dependencies);

  return Object.freeze({
    createOpenId,
    getOpenIdByProviderAndSub,
    getOpenIdByProviderAndUserId,
    deleteOpenId,
  });
};

export { createDeleteOpenId };
