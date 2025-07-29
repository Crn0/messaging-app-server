import "dotenv/config";
import { Router } from "express";
import { join } from "path";
import Storage from "../storage/index.js";
import initMulter from "../lib/multer.js";
import userRepository from "./user-repository.js";
import profileRepository from "./profile/profile-repository.js";
import tokenRepository from "../auth/token/token-repository.js";
import openIdRepository from "../auth/open-id/open-id-repository.js";
import friendRequestRepository from "./friend-request/friend-request-repository.js";
import friendRepository from "./friend/friend-repository.js";
import chatRepository from "../chat/chat-repository.js";
import blockUserRepository from "./block-user/block-user-repository.js";
import initUserService, { createGetUserPkbyId } from "./user-service.js";
import initProfileService, {
  createDeleteBackgroundAvatarByUserId,
  createDeleteProfileAvatarByUserId,
} from "./profile/profile-service.js";
import {
  createGetUserMessagesById,
  createDeleteMessageById,
} from "../chat/chat-service.js";
import initTokenService from "../auth/token/token-service.js";
import initOpenIdService, {
  createGetOpenIdsByUserId,
} from "../auth/open-id/open-id-service.js";
import initFriendRequestService from "./friend-request/friend-request-service.js";
import initFriendService from "./friend/friend-service.js";
import initBlockUserService from "./block-user/block-user-service.js";
import initUserController from "./user-controller.js";
import initUserMiddleware from "./user-middleware.js";
import createJwtUtils from "../auth/jwt.js";
import * as schema from "./user-schema.js";
import userPolicy from "./policy.js";
import { cookieConfig } from "../auth/auth-service.js";
import { createLogOutController } from "../auth/auth-controller.js";
import {
  createAccessTokenMiddleware,
  protectRoute,
} from "../auth/auth-middleware.js";
import {
  ZodbodyValidator,
  ZodparamValidator,
  ZodfileValidator,
} from "../middleware/index.js";
import { obtuseEmail, verifyPassword, hashPassword } from "../helpers/index.js";
import { idGenerator, removeFields } from "./utils.js";

const dirname = import.meta?.dirname;

const uploadTempPath = join(dirname, "..", "..", "temp", "upload");

const router = Router();

/**
 * LIB
 */

const { multer, MulterError } = initMulter({
  path: uploadTempPath,
  limits: {
    files: 2,
  },
});

const storage = Storage();

/**
 * UTILS
 */

const jwtUtils = createJwtUtils({
  idGenerator,
  secret: process.env.NODE_ENV === "prod" ? process.env.JWT_SECRET : "secret",
});

/**
 * SERVICE
 */

const getUserMessagesById = createGetUserMessagesById({ chatRepository });

const deleteMessageById = createDeleteMessageById({ chatRepository, storage });

const deleteProfileAvatarByUserId = createDeleteProfileAvatarByUserId({
  profileRepository,
  storage,
  userService: {
    getUserPkById: createGetUserPkbyId({ userRepository }),
  },
});

const deleteBackgroundAvatar = createDeleteBackgroundAvatarByUserId({
  profileRepository,
  storage,
  userService: {
    getUserPkById: createGetUserPkbyId({ userRepository }),
  },
});

const userService = initUserService({
  userRepository,
  chatService: { getUserMessagesById, deleteMessageById },
  profileService: {
    deleteProfileAvatarByUserId,
    deleteBackgroundAvatar,
  },
  passwordManager: { verifyPassword, hashPassword },
  openIdService: {
    getOpenIdsByUserId: createGetOpenIdsByUserId({ openIdRepository }),
  },
});

const profileService = initProfileService({
  profileRepository,
  userService,
  storage,
});

const tokenService = initTokenService({ tokenRepository, jwtUtils });

const openIdService = initOpenIdService({ openIdRepository, userService });

const friendRequestService = initFriendRequestService({
  friendRequestRepository,
  userService,
});

const friendService = initFriendService({
  friendRepository,
  friendRequestService,
});

const blockUserService = initBlockUserService({
  blockUserRepository,
  userService,
});

/**
 * CONTROLLER
 */

const userController = initUserController({
  userService,
  profileService,
  openIdService,
  friendRequestService,
  friendService,
  blockUserService,
  utils: {
    removeFields,
    obtuseEmail,
  },
});

const logOutController = createLogOutController({
  jwtUtils,
  cookieConfig,
  tokenService,
});

/**
 * MIDDLEWARE
 */

const userMiddleware = initUserMiddleware({
  userPolicy,
  userService,
  blockUserService,
  friendRequestService,
  friendService,
  openIdService,
  multer,
  MulterError,
});

const readAcessToken = createAccessTokenMiddleware({ jwtUtils });

/**
 * ROUTE
 */

router.use(readAcessToken);
router.use(protectRoute("accessToken"));

router.get("/me", userController.me);

router.patch(
  "/me/username",
  ZodbodyValidator(schema.updateUsernameSchema),
  userMiddleware.canUpdateUsername,
  userController.patchUsername
);

router.patch(
  "/me/password",
  ZodbodyValidator(schema.updatePasswordSchema),
  userMiddleware.canUpdatePassword,
  userController.patchPassword,
  logOutController
);

router.delete(
  "/me",
  userMiddleware.canDeleteAccount,
  userController.deleteAccount
);

router.delete(
  "/me/providers/google",
  userMiddleware.canUnlinkGoogle,
  userController.unlinkGoogle
);

/**
 *  BLOCK USERS ROUTE
 */

router.post(
  "/me/block-users",
  ZodbodyValidator(schema.blockUserBodySchema),
  userMiddleware.canBlockUser,
  userController.blockUser
);

router.delete(
  "/me/block-users/:unBlockId",
  ZodparamValidator(schema.unBlockUserParamSchema),
  userMiddleware.canUnBlockUser,
  userController.unBlockUser
);

/**
 * FRIEND REQUESTS ROUTE
 */

router.get("/me/friend-requests", userController.getFriendRequestList);

router.post(
  "/me/friend-requests",
  ZodbodyValidator(schema.friendRequestBodySchema),
  userMiddleware.canSendFriendRequest,
  userController.sendFriendRequest
);

router.patch(
  "/me/friend-requests/:friendRequestId",
  ZodparamValidator(schema.friendRequestParamSchema),
  userMiddleware.canAcceptFriendRequest,
  userController.acceptFriendRequest
);

router.delete(
  "/me/friend-requests/:friendRequestId",
  ZodparamValidator(schema.friendRequestParamSchema),
  userMiddleware.canDeleteFriendRequest,
  userController.deleteFriendRequest
);

router.delete(
  "/me/friends/:friendId",
  ZodparamValidator(schema.friendParamSchema),
  userMiddleware.canUnfriendUser,
  userController.unFriend
);

/**
 * PROFILES ROUTE
 */

router.patch(
  "/me/profile",
  userMiddleware.uploader.fields([
    { name: "avatar", maxCount: 1 },
    { name: "backgroundAvatar", maxCount: 1 },
  ]),
  ZodbodyValidator(schema.updateProfileSchema),
  userController.patchProfile
);

router.delete("/me/profile/avatar", userController.deleteProfileAvatar);

router.delete(
  "/me/profile/background-avatar",
  userController.deleteBackgroundAvatar
);

export default router;
