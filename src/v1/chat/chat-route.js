import "dotenv/config";
import { Router } from "express";
import { join } from "path";
import Storage from "../storage/index.js";
import initMulter from "../lib/multer.js";
import userRepository from "../user/user-repository.js";
import chatRepository from "./chat-repository.js";
import permissionRepository from "../permission/permission-repository.js";
import roleRepository from "../role/role-repository.js";
import blockUserRepository from "../user/block-user/block-user-repository.js";
import initChatService, {
  createGetChatById,
  createGetChatMemberById,
} from "./chat-service.js";
import initPermissionService from "../permission/permission-service.js";
import initRoleService from "../role/role-service.js";
import initBlockUserService from "../user/block-user/block-user-service.js";
import initJwtUtils from "../auth/jwt.js";
import initChatController from "./chat-controller.js";
import initChatMiddleware from "./chat-middleware.js";
import chatPolicy from "./policy.js";
import * as schema from "./chat-schema.js";
import { createGetUserById } from "../user/user-service.js";
import {
  createAccessTokenMiddleware,
  protectRoute,
} from "../auth/auth-middleware.js";
import {
  ZodbodyValidator,
  ZodqueryValidator,
  ZodparamValidator,
} from "../middleware/index.js";
import { idGenerator, removeFields, removeTempImages } from "./utils.js";

const dirname = import.meta?.dirname;

const uploadTempPath = join(dirname, "..", "..", "temp", "upload");

const router = Router();

/**
 * LIB
 */

const { multer, MulterError } = initMulter({
  path: uploadTempPath,
  limits: {
    files: 5,
  },
});

const storage = Storage();

/**
 * UTILS
 */

const jwtUtils = initJwtUtils({
  idGenerator,
  secret: process.env.NODE_ENV === "prod" ? process.env.JWT_SECRET : "secret",
});

/**
 * SERVICE
 */

const userService = {
  getUserById: createGetUserById({ userRepository }),
};

const permissionService = initPermissionService({ permissionRepository });

const roleService = initRoleService({
  roleRepository,
  userService,
  permissionService,
  chatService: {
    getChatById: createGetChatById({ chatRepository }),
    getMemberById: createGetChatMemberById({ chatRepository }),
  },
});

const blockUserService = initBlockUserService({
  blockUserRepository,
  userService,
});

const chatService = initChatService({
  chatRepository,
  userService,
  roleService,
  storage,
  utils: {
    idGenerator,
  },
});
/**
 * CONTROLLER
 */

const chatController = initChatController({
  chatService,
  roleService,
  utils: {
    removeFields,
    cleanup: () => {
      removeTempImages(uploadTempPath);
    },
  },
});

/**
 * MIDDLEWARE
 */

const chatMiddleware = initChatMiddleware({
  chatService,
  roleService,
  blockUserService,
  chatPolicy,
  multer,
  MulterError,
});

const readAcessToken = createAccessTokenMiddleware({ jwtUtils });

/**
 * ROUTE
 */

router.use(readAcessToken);
router.use(protectRoute("accessToken"));

// ===========
// CHAT ROUTE
// ==========

router.get("/", chatController.getChats);

router.get(
  "/public",
  ZodqueryValidator(schema.paginationQuerySchema),
  chatController.getPublicChats
);

router.get(
  "/:chatId",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canViewChat,
  chatController.getChat
);

router.post(
  "/",
  chatMiddleware.uploader.single("avatar"),
  ZodbodyValidator(schema.chatFormSchema),
  chatMiddleware.canCreateChat,
  chatController.createChat
);

router.patch(
  "/:chatId/name",
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.patchChatNameSchema),
  chatMiddleware.canUpdateChatName,
  chatController.updateChatName
);

router.patch(
  "/:chatId/avatar",
  chatMiddleware.uploader.single("avatar"),
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.patchChatAvatarSchema),
  chatMiddleware.canUpdateChatAvatar,
  chatController.updateChatAvatar
);

router.delete(
  "/:chatId",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canDeleteChat,
  chatController.deleteChat
);

// =================
// CHAT MEMBER ROUTE
// =================

router.get(
  "/:chatId/members",
  ZodparamValidator(schema.memberListParamSchema),
  chatMiddleware.canViewMember,
  chatController.getMemmbers
);

router.get(
  "/:chatId/members/me",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canViewMember,
  chatController.getMember
);

router.get(
  "/:chatId/members/:memberId",
  ZodparamValidator(schema.memberParamSchema),
  chatMiddleware.canViewMember,
  chatController.getMember
);

router.post(
  "/:chatId/members",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canMemberJoin,
  chatController.memberJoin
);

router.patch(
  "/:chatId/members/:memberId/mute",
  ZodparamValidator(schema.memberParamSchema),
  ZodbodyValidator(schema.patchMemberMuteSchema),
  chatMiddleware.canMuteMember,
  chatController.muteMember
);

router.delete(
  "/:chatId/members/me",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canLeaveChat,
  chatController.deleteMember
);

router.delete(
  "/:chatId/members/:memberId/kick",
  ZodparamValidator(schema.memberParamSchema),
  chatMiddleware.canKickMember,
  chatController.deleteMember
);

// =================
// CHAT ROLE ROUTE
// =================

router.get(
  "/:chatId/roles",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canViewRole,
  chatController.getRoles
);

router.get(
  "/:chatId/roles/me",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canViewUserRole,
  chatController.getUserRoles
);

router.get(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  chatMiddleware.canViewRole,
  chatController.getRole
);

router.post(
  "/:chatId/roles",
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.roleFormSchema),
  chatMiddleware.canCreateRole,
  chatController.createRole
);

router.patch(
  "/:chatId/roles/role-levels",
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.patchRoleLevelsSchema),
  chatMiddleware.canUpdateRoleLevels,
  chatController.updateRoleLevels
);

router.patch(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  ZodbodyValidator(schema.patchRoleMetaDataSchema),
  chatMiddleware.canUpdateRoleMetaData,
  chatController.updateRoleMetaData
);

router.patch(
  "/:chatId/roles/:roleId/members",
  ZodparamValidator(schema.roleParamSchema),
  ZodbodyValidator(schema.patchRoleMembersSchema),
  chatMiddleware.canUpdateRoleMembers,
  chatController.updateRoleMembers
);

router.delete(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  chatMiddleware.canDeleteRole,
  chatController.deleteRole
);

router.delete(
  "/:chatId/roles/:roleId/members/:memberId",
  ZodparamValidator(schema.roleMemberParamSchema),
  chatMiddleware.canUpdateRoleMembers,
  chatController.deleteRoleMember
);

router.get(
  "/:chatId/roles",
  ZodparamValidator(schema.chatParamSchema),
  chatMiddleware.canViewRole,
  chatController.getRoles
);

router.get(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  chatMiddleware.canViewRole,
  chatController.getRole
);

router.post(
  "/:chatId/roles",
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.roleFormSchema),
  chatMiddleware.canCreateRole,
  chatController.createRole
);

router.patch(
  "/:chatId/roles/role-levels",
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.patchRoleLevelsSchema),
  chatMiddleware.canUpdateRoleLevels,
  chatController.updateRoleLevels
);

router.patch(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  ZodbodyValidator(schema.patchRoleMetaDataSchema),
  chatMiddleware.canUpdateRoleMetaData,
  chatController.updateRoleMetaData
);

router.patch(
  "/:chatId/roles/:roleId/members",
  ZodparamValidator(schema.roleParamSchema),
  ZodbodyValidator(schema.patchRoleMembersSchema),
  chatMiddleware.canUpdateRoleMembers,
  chatController.updateRoleMembers
);

router.delete(
  "/:chatId/roles/:roleId",
  ZodparamValidator(schema.roleParamSchema),
  chatMiddleware.canDeleteRole,
  chatController.deleteRole
);

router.delete(
  "/:chatId/roles/:roleId/members/:memberId",
  ZodparamValidator(schema.roleMemberParamSchema),
  chatMiddleware.canUpdateRoleMembers,
  chatController.deleteRoleMember
);

// =================
// CHAT MESSAGE ROUTE
// =================

router.get(
  "/:chatId/messages",
  ZodparamValidator(schema.chatParamSchema),
  ZodqueryValidator(schema.paginationQuerySchema),
  chatMiddleware.canViewMessage,
  chatController.getMessages
);

router.post(
  "/:chatId/messages",
  chatMiddleware.uploader.array("attachments", 5),
  ZodparamValidator(schema.chatParamSchema),
  ZodbodyValidator(schema.messageFormSchema),
  chatMiddleware.canSendMessage,
  chatController.sendMessage
);

router.post(
  "/:chatId/messages/:messageId/replies",
  chatMiddleware.uploader.array("attachments", 5),
  ZodparamValidator(schema.messageParamSchema),
  ZodbodyValidator(schema.messageFormSchema),
  chatMiddleware.canSendMessage,
  chatController.sendReply
);

router.delete(
  "/:chatId/messages/:messageId",
  ZodparamValidator(schema.messageParamSchema),
  chatMiddleware.canDeleteMessage,
  chatController.deleteMessage
);

export default router;
