import Debug from "./debug.js";
import { httpStatus } from "../../constants/index.js";
import { tryCatchSync } from "../helpers/index.js";
import ApiError from "../../errors/api-error.js";
import AuthError from "../../errors/auth-error.js";

const debug = Debug.extend("middleware");

const createAuthenticator =
  ({ passport }) =>
  (strategy) =>
    passport.authenticate(strategy, { session: false });

const createAuthenticateLocal =
  ({ passport }) =>
  (req, res, next) =>
    passport.authenticate("local", { session: false }, (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user || info) {
        return next(new AuthError(info.message, httpStatus.UNPROCESSABLE));
      }
      req.user = user;

      return next();
    })(req, res, next);

const createGoogleAuthFlow =
  ({ passport }) =>
  (req, res, next) =>
    passport.authenticate("google", { session: false }, (err, openId, _) => {
      if (err) return next(err);

      const user = openId?.user;

      if (!user) return res.redirect("/api/v1/auth/google");

      req.user = user;

      return next();
    })(req, res, next);

const canRegister = (req, res, next) => {
  if (req.refreshToken) {
    throw new AuthError(
      "You are authenticated. Registration is restricted.",
      httpStatus.FORBIDDEN
    );
  }

  return next();
};

const createRefreshTokenMiddleware =
  ({ jwtUtils }) =>
  (req, _, next) => {
    const { refreshToken } = req.cookies;

    const { data: verifiedToken } = tryCatchSync(() =>
      jwtUtils.verifyToken(refreshToken)
    );

    debug("refresh token middleware");

    req.ctx = {
      ...req.ctx,
      refreshToken: verifiedToken,
    };

    return next();
  };

const createAccessTokenMiddleware =
  ({ jwtUtils }) =>
  (req, _, next) => {
    const bearerHeader = req.headers.authorization;

    if (typeof bearerHeader === "undefined") {
      return next(
        new AuthError(
          "Required 'Authorization' header is missing",
          httpStatus.UNAUTHORIZED
        )
      );
    }

    const bearer = bearerHeader.split(" ");
    const accessToken = bearer[1];

    const { error, data: verifiedToken } = tryCatchSync(() =>
      jwtUtils.verifyToken(accessToken)
    );

    if (error) {
      return next(error);
    }

    const user = verifiedToken !== null ? { id: verifiedToken.sub } : null;

    req.user = user;

    return next();
  };

const createSocketAccessTokenMiddleware =
  ({ jwtUtils }) =>
  (socket, next) => {
    const socketRef = socket;

    const accessToken = socketRef?.handshake?.auth?.accessToken;

    const { error, data: verifiedToken } = tryCatchSync(() =>
      jwtUtils.verifyToken(accessToken)
    );

    if (error) {
      return next(error);
    }

    const user = verifiedToken !== null ? { id: verifiedToken.sub } : null;

    socketRef.data.user = user;

    return next();
  };

const protectRoute = (tokenType) => (req, _, next) => {
  if (tokenType === "accessToken") {
    if (!req.user) {
      return next(
        new ApiError("Invalid or expired token", httpStatus.UNAUTHORIZED)
      );
    }

    return next();
  }

  if (!req.ctx?.refreshToken) {
    return next(
      new ApiError("Invalid or expired token", httpStatus.UNAUTHORIZED)
    );
  }

  return next();
};

export default (dependencies) => {
  const authenticateLocal = createAuthenticateLocal(dependencies);
  const authenticate = createAuthenticator(dependencies);
  const googleAuthFlow = createGoogleAuthFlow(dependencies);
  const readRefreshToken = createRefreshTokenMiddleware(dependencies);
  const readAcessToken = createAccessTokenMiddleware(dependencies);
  const readSocketAccessToken = createSocketAccessTokenMiddleware(dependencies);

  return Object.freeze({
    canRegister,
    protectRoute,
    authenticateLocal,
    authenticate,
    googleAuthFlow,
    readRefreshToken,
    readAcessToken,
    readSocketAccessToken,
  });
};

export {
  canRegister,
  protectRoute,
  createRefreshTokenMiddleware,
  createAccessTokenMiddleware,
  createSocketAccessTokenMiddleware,
};
