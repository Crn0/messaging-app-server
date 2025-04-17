import Debug from "./debug.js";
import { tryCatchSync, tryCatchAsync } from "../helpers/index.js";
import { env, httpStatus } from "../../constants/index.js";

const debug = Debug.extend("controller");

const createRegisterController =
  ({ userService }) =>
  async (req, res, next) => {
    const { error, data } = await tryCatchAsync(
      userService.createUser(req.body)
    );

    if (error) {
      return next(error);
    }

    debug("User successful sign-up");
    debug(data);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createRedirectAuthController =
  ({ authService, generateTokens }) =>
  async (req, res) => {
    const { user } = req;
    let redirectURL = env.CLIENT_URL;

    res.clearCookie("refreshToken", authService.cookieConfig);

    const { refreshToken } = generateTokens(user);

    res.cookie("refreshToken", refreshToken, authService.cookieConfig);

    if (!redirectURL.endsWith("/")) {
      redirectURL += "/";
    }

    res.redirect(redirectURL);
  };

const createLogInController =
  ({ cookieConfig, userService, tokenService, generateTokens }) =>
  async (req, res, next) => {
    const oldToken = req.ctx?.refreshToken;

    if (oldToken) {
      debug("User has an ongoing session");

      res.clearCookie("refreshToken", cookieConfig);

      const { jti, sub, exp } = oldToken;

      const tokenExist = await tokenService.getRefreshTokenById(jti);

      const { error: userError, data: userExist } = await tryCatchAsync(
        userService.getUserById(sub)
      );

      if (userError) {
        debug("Current user does not exist");
        return next(userError);
      }

      if (userExist && !tokenExist) {
        const expiresIn = new Date(exp * 1000);
        await tokenService
          .blackListRefreshToken(jti, expiresIn, sub)
          .then((token) =>
            debug(`Valid refresh token blacklisted: ${JSON.stringify(token)}`)
          );
      }
    }
    const user = req?.user ?? { id: oldToken.sub };

    const { refreshToken, accessToken } = generateTokens(user);

    res.cookie("refreshToken", refreshToken, cookieConfig);

    debug(
      `${req?.user ? "User login successfull" : "User refresh access token"}`
    );

    return res.status(httpStatus.OK).json({ token: accessToken });
  };

const createLogOutController =
  ({ jwtUtils, cookieConfig, tokenService }) =>
  async (req, res, next) => {
    const { cookies } = req;
    const { refreshToken } = cookies;
    const { error, data: decodedToken } = tryCatchSync(() =>
      jwtUtils.verifyToken(refreshToken)
    );

    if (error) {
      return next(error);
    }

    if (decodedToken) {
      const { jti, sub, exp } = decodedToken;

      const refreshTokenExist = await tokenService.getRefreshTokenById(jti);

      if (refreshTokenExist) {
        debug("refresh token is already blacklisted");
        return res.sendStatus(httpStatus.NO_CONTENT_REFRESH);
      }

      const expiresIn = new Date(exp * 1000);

      await tokenService.blackListRefreshToken(jti, expiresIn, sub);

      debug("Token blacklisted");

      res.clearCookie("refreshToken", cookieConfig);

      return res.sendStatus(httpStatus.NO_CONTENT_REFRESH);
    }

    debug("User logout");

    return res.sendStatus(httpStatus.NO_CONTENT_REFRESH);
  };

export default (dependencies) => {
  const redirectAuthFlow = createRedirectAuthController(dependencies);

  const registerLocal = createRegisterController(dependencies);

  const logIn = createLogInController(dependencies);

  const logOut = createLogOutController(dependencies);

  return Object.freeze({
    redirectAuthFlow,
    registerLocal,
    logIn,
    logOut,
  });
};

export { createLogOutController };
