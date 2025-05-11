import { env } from "../../../constants/index.js";

const { NODE_ENV } = env;

const createTokenGenerator =
  ({ jwtUtils }) =>
  (user) => {
    const accessTokenExpiration = NODE_ENV === "prod" ? "15" : "2000";
    const refreshTokenExpiration = NODE_ENV === "prod" ? "7" : "20";

    const refreshToken = jwtUtils.generateRefreshToken(
      user.id,
      refreshTokenExpiration
    );
    const accessToken = jwtUtils.generateAccessToken(
      user.id,
      accessTokenExpiration
    );

    return { refreshToken, accessToken };
  };

const createBlackListRefreshToken =
  ({ tokenRepository }) =>
  async (id, expiresIn, userId) => {
    const token = await tokenRepository.insert(
      id,
      expiresIn,
      "RefreshToken",
      userId
    );

    return token;
  };

const createBlackListActionToken =
  ({ tokenRepository }) =>
  async (id, expiresIn, userId) => {
    const token = await tokenRepository.insert(
      id,
      expiresIn,
      "ActionToken",
      userId
    );

    return token;
  };

const createGetRefreshTokenById =
  ({ tokenRepository }) =>
  async (id) =>
    tokenRepository.getTokenById(id, "RefreshToken");

const createGetActionTokenById =
  ({ tokenRepository }) =>
  async (id) =>
    tokenRepository.getTokenById(id, "ActionToken");

const createDeleteExpiredTokens =
  ({ tokenRepository }) =>
  async () =>
    tokenRepository.deleteExpiredTokens();

export default (dependencies) => {
  const generateTokens = createTokenGenerator(dependencies);

  const blackListRefreshToken = createBlackListRefreshToken(dependencies);
  const blackListActionToken = createBlackListActionToken(dependencies);

  const getRefreshTokenById = createGetRefreshTokenById(dependencies);
  const getActionTokenById = createGetActionTokenById(dependencies);

  const deleteExpiredTokens = createDeleteExpiredTokens(dependencies);

  return Object.freeze({
    generateTokens,
    blackListActionToken,
    blackListRefreshToken,
    getActionTokenById,
    getRefreshTokenById,
    deleteExpiredTokens,
  });
};
