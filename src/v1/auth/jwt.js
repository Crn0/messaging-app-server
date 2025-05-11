import jwt from "jsonwebtoken";
import { httpStatus } from "../../constants/index.js";
import AuthError from "../../errors/auth-error.js";

const decodeToken = (token) => jwt.decode(token);

const createVerify =
  ({ secret }) =>
  (token) => {
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      throw new AuthError("Invalid or expired token", httpStatus.UNAUTHORIZED);
    }
  };

const createAccessTokenGenerator =
  ({ secret }) =>
  (id, expiresInMinutes) =>
    jwt.sign({}, secret, {
      expiresIn: `${expiresInMinutes}m`,
      subject: id,
    });

const createRefreshTokenGenerator =
  ({ secret, idGenerator }) =>
  (id, expiresInDays) =>
    jwt.sign({}, secret, {
      jwtid: idGenerator(),
      subject: id,
      expiresIn: `${expiresInDays}d`,
    });

const createJwtUtils = (deps) => ({
  decodeToken,
  verifyToken: createVerify(deps),
  generateAccessToken: createAccessTokenGenerator(deps),
  generateRefreshToken: createRefreshTokenGenerator(deps),
});

export default createJwtUtils;
