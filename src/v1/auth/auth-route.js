import "dotenv/config";
import { Router } from "express";
import passport from "passport";
import initPassportStrategy from "./passport-strategy.js";
import userRepository from "../user/user-repository.js";
import openIDRepository from "./open-id/open-id-repository.js";
import tokenRepository from "./token/token-repository.js";
import initAuthService from "./auth-service.js";
import initUserService from "../user/user-service.js";
import initOpenIdService from "./open-id/open-id-service.js";
import initTokenService from "./token/token-service.js";
import initAuthController from "./auth-controller.js";
import initAuthMiddleware from "./auth-middleware.js";
import createJwtUtils from "./jwt.js";
import { ZodbodyValidator } from "../middleware/index.js";
import { signUpSchema, logInSchema } from "../user/user-schema.js";
import {
  randomUsername,
  idGenerator,
  verifyPassword,
  hashPassword,
} from "./utils.js";

const router = Router();

const jwtUtils = createJwtUtils({
  secret: process.env.NODE_ENV === "prod" ? process.env.JWT_SECRET : "secret",
  idGenerator,
});

/**
 * SERVICE
 */

const userService = initUserService({
  userRepository,
  passwordManager: { hashPassword },
});
const openIdService = initOpenIdService({ openIDRepository });
const tokenService = initTokenService({ tokenRepository, jwtUtils });

const authService = initAuthService({
  userService,
  openIdService,
  randomUsername,
  verifyPassword,
  jwtUtils,
});

/**
 * PASSPORT STRATEGY
 */

const passportStrategy = initPassportStrategy({
  authenticateLocal: authService.authenticateLocal,
  authenticateGoogle: authService.authenticateOpenId,
});

passport.use("local", passportStrategy.local);
passport.use("google", passportStrategy.google);

/**
 * CONTROLLER
 */

const authController = initAuthController({
  authService,
  userService,
  tokenService,
  jwtUtils,
  generateTokens: tokenService.generateTokens,
  registerLocal: authService.registerLocal,
  unlinkOpenId: authService.unlinkOpenId,
  cookieConfig: authService.cookieConfig,
});

/**
 * MIDDLEWARE
 */

const authMiddleware = initAuthMiddleware({ passport, jwtUtils });

/**
 * ROUTE
 */

router.get("/google", authMiddleware.authenticate("google"));

router.use(authMiddleware.readRefreshToken);

router.get(
  "/google/callback",
  authMiddleware.googleAuthFlow,
  authController.redirectAuthFlow
);

router.post(
  "/register",
  authMiddleware.canRegister,
  ZodbodyValidator(signUpSchema),
  authController.registerLocal
);

router.post(
  "/login",
  ZodbodyValidator(logInSchema),
  authMiddleware.authenticateLocal,
  authController.logIn
);

router.post("/logout", authController.logOut);

/**
 * When the client request endpoint:  POST: /auth/password-resets
 * with the email in the request body {"email": "example@gmail.com"}
 * the server will send a message to the email containing a link with token as the params
 * to reset the password
 */

// router.get(
//   "/password-resets/tokens/:token",
//   ZodbodyValidator(schema.passwordResetQueryTokenSchema),
//   (req, res) => res.sendStatus(201)
// );

// router.post(
//   "/password-resets",
//   ZodbodyValidator(schema.passwordResetSchema),
//   (req, res) => res.sendStatus(501)
// );

// router.patch(
//   "/password-resets/tokens/:token",
//   ZodbodyValidator(schema.passwordResetQueryTokenSchema),
//   (req, res) => res.sendStatus(201)
// );

router.use(authMiddleware.protectRoute("refreshToken"));

router.post("/refresh-tokens", authController.logIn);

export default router;
