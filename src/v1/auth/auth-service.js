import Debug from "./debug.js";
import { env, httpStatus } from "../../constants/index.js";
import AuthError from "../../errors/auth-error.js";

const { NODE_ENV } = env;

const cookieConfig = {
  httpOnly: true,
  secure: NODE_ENV === "prod",
  sameSite: NODE_ENV === "prod" ? "none" : "lax",
};

const debug = Debug.extend("service");

const createAuthenticateOpenId =
  ({ userService, openIdService, randomUsername }) =>
  async ({ token, provider, sub, email, firstName, lastName }) => {
    let username = randomUsername({ firstName, lastName });

    let userExist = await userService.getUserByUsername(username);

    while (userExist && userExist.username === username) {
      username = randomUsername({ firstName, lastName });

      // eslint-disable-next-line no-await-in-loop
      userExist = await userService.getUserByUsername(username);
    }

    const data = {
      provider,
      token,
      sub,
      username,
      email,
    };

    const user = await openIdService.upsertOpenId(data);

    debug("logging in:", user);

    return user;
  };

const createAuthenticateLocal =
  ({ userService, verifyPassword }) =>
  async ({ username, password }) => {
    let user = await userService.getUserByUsername(username);

    if (!user) {
      user = await userService.getUserByEmail(username);
    }

    if (!user) {
      throw new AuthError("Invalid user credentials", httpStatus.UNPROCESSABLE);
    }

    const match = await verifyPassword(user.password, password);

    if (!match) {
      throw new AuthError("Invalid user credentials", httpStatus.UNPROCESSABLE);
    }

    return user;
  };

export default (dependencies) => {
  const authenticateLocal = createAuthenticateLocal(dependencies);

  const authenticateOpenId = createAuthenticateOpenId(dependencies);

  return Object.freeze({
    cookieConfig,
    authenticateLocal,
    authenticateOpenId,
  });
};

export { cookieConfig };
