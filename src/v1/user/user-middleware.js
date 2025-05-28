import { tryCatchAsync, tryCatchSync } from "../helpers/index.js";
import ValidationError from "../../errors/validation-error.js";
import APIError from "../../errors/api-error.js";

const createUploader =
  ({ multer, MulterError }) =>
  (field) =>
  (req, res, next) =>
    multer.single(field)(req, res, (err) => {
      if (err instanceof MulterError) {
        const { code } = err;

        if (code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ValidationError("Validation Error", [
              {
                code: "custom",
                message: "Only one file can be uploaded at a time",
                path: [field],
              },
            ])
          );
        }

        return next(err);
      }

      if (err) {
        return next(err);
      }

      return next();
    });

const createCanUpdateUsername =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error: userError, data: user } = await tryCatchAsync(async () =>
      userService.getUserById(userId)
    );

    if (userError) {
      return next(userError);
    }

    const { success, code, message } = userPolicy.checkUpdateUsername(user);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUpdateEmail =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error: userError, data: user } = await tryCatchAsync(async () =>
      userService.getUserById(userId)
    );

    if (userError) {
      return next(userError);
    }

    const { error } = tryCatchSync(() => {
      userPolicy.checkUpdateEmailPermission(user);
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUpdatePassword =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error: userError, data: user } = await tryCatchAsync(async () =>
      userService.getUserById(userId)
    );

    if (userError) {
      return next(userError);
    }

    const { success, code, message } = userPolicy.checkUpdatePassword(user);

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanSendFriendRequest =
  ({ userPolicy, blockUserService, friendRequestService, friendService }) =>
  async (req, res, next) => {
    const { user } = req;
    const targetUser = { id: req.body.friendId };

    const [
      userFriendsResult,
      userBlockListResult,
      targetUserBLockListResult,
      pendingFriendRequestResult,
    ] = await Promise.all([
      tryCatchAsync(() => friendService.getUserFriendsById(user.id)),
      tryCatchAsync(() => blockUserService.getUserBlockList(user.id)),
      tryCatchAsync(() => blockUserService.getUserBlockList(targetUser.id)),
      tryCatchAsync(() =>
        friendRequestService.isFriendRequestExist(user.id, targetUser.id)
      ),
    ]);

    const { error: userFriendsError, data: userFriends } = userFriendsResult;

    const { error: userBlockListError, data: userBlockList } =
      userBlockListResult;

    const { error: targetUserBLockListError, data: targetUserBlockList } =
      targetUserBLockListResult;

    const {
      error: hasPendingFriendRequestError,
      data: hasPendingFriendRequest,
    } = pendingFriendRequestResult;

    if (
      userFriendsError ||
      userBlockListError ||
      targetUserBLockListError ||
      hasPendingFriendRequestError
    ) {
      return next(
        userFriendsError ||
          userBlockListError ||
          targetUserBLockListError ||
          hasPendingFriendRequestError
      );
    }

    user.friends = userFriends;
    user.blockedUsers = userBlockList;
    targetUser.blockedUsers = targetUserBlockList;

    const { success, code, message } = userPolicy.checkSendFriendRequest(
      user,
      targetUser,
      hasPendingFriendRequest
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanAcceptFriendRequest =
  ({ userPolicy, friendRequestService }) =>
  async (req, res, next) => {
    const { user } = req;
    const { friendRequestId } = req.params;

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.getFriendRequestById(friendRequestId)
      );

    if (friendRequestError) {
      return next(friendRequestError);
    }

    const { success, code, message } = userPolicy.checkAcceptFriendRequest(
      user,
      friendRequest
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanDeleteFriendRequest =
  ({ userPolicy, friendRequestService }) =>
  async (req, res, next) => {
    const { user } = req;
    const { friendRequestId } = req.params;

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.getFriendRequestById(friendRequestId)
      );

    if (friendRequestError) {
      return next(friendRequestError);
    }

    const { success, code, message } = userPolicy.checkDeleteFriendRequest(
      user,
      friendRequest
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUnFriendUser =
  ({ userPolicy, friendService }) =>
  async (req, res, next) => {
    const { user } = req;
    const targetUser = { id: req.params.friendId };

    const friends = await friendService.getUserFriendsById(user.id);

    req.ctx = {
      ...req.ctx,
      userFriends: friends,
    };

    const { error } = tryCatchSync(() =>
      userPolicy.checkUnFriendPermission({
        targetUser,
        friends,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanBlockUser =
  ({ userPolicy, blockUserService }) =>
  async (req, res, next) => {
    const { user } = req;
    const targetUser = { id: req.body.blockId };

    const userBlockList = await blockUserService.getUserBlockList(user.id);

    user.blockedUsers = userBlockList;

    const { success, code, message } = userPolicy.checkBlockUser(
      user,
      targetUser
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanUnBlockUser =
  ({ userPolicy, blockUserService }) =>
  async (req, res, next) => {
    const { user } = req;
    const targetUser = { id: req.params.unBlockId };

    const userBlockList = await blockUserService.getUserBlockList(user.id);

    user.blockedUsers = userBlockList;

    const { success, code, message } = userPolicy.checkUnBlockUser(
      user,
      targetUser
    );

    if (!success) {
      return next(new APIError(message, code));
    }

    return next();
  };

const createCanDeleteAccount =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;
    const { error: userError, data: user } = await tryCatchAsync(async () =>
      userService.getUserById(userId)
    );

    if (userError) {
      return next(userError);
    }

    const ownedChats = await userService.getUserOwnedChatsById(user.id);

    user.ownedChats = ownedChats;

    const { success, code, message } = userPolicy.checkDeleteAccount(user);

    if (!success) {
      return next(new APIError(message, code));
    }
    return next();
  };

const createCanUnlinkGoogle =
  ({ userPolicy, openIdService }) =>
  async (req, res, next) => {
    const { user } = req;

    const { error } = await tryCatchAsync(async () => {
      const openId = await openIdService.getOpenIdByProviderAndUserId(
        "google",
        user.id
      );

      return userPolicy.checkGoogleUnlinkPermissions(user, openId);
    });

    if (error) {
      return next(error);
    }

    return next();
  };

export default (dependencies) => {
  const uploader = createUploader(dependencies);
  const canUpdateUsername = createCanUpdateUsername(dependencies);
  const canUpdateEmail = createCanUpdateEmail(dependencies);
  const canUpdatePassword = createCanUpdatePassword(dependencies);
  const canSendFriendRequest = createCanSendFriendRequest(dependencies);
  const canDeleteFriendRequest = createCanDeleteFriendRequest(dependencies);
  const canAcceptFriendRequest = createCanAcceptFriendRequest(dependencies);
  const canUnfriendUser = createCanUnFriendUser(dependencies);
  const canBlockUser = createCanBlockUser(dependencies);
  const canUnBlockUser = createCanUnBlockUser(dependencies);
  const canDeleteAccount = createCanDeleteAccount(dependencies);
  const canUnlinkGoogle = createCanUnlinkGoogle(dependencies);

  return Object.freeze({
    uploader,
    canUpdateUsername,
    canUpdateEmail,
    canUpdatePassword,
    canSendFriendRequest,
    canDeleteFriendRequest,
    canAcceptFriendRequest,
    canUnfriendUser,
    canBlockUser,
    canUnBlockUser,
    canDeleteAccount,
    canUnlinkGoogle,
  });
};
