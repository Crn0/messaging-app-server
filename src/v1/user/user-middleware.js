import { tryCatchAsync, tryCatchSync } from "../helpers/index.js";
import ValidationError from "../../errors/validation-error.js";

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

const createIsAuthorizedUser =
  ({ userPolicy }) =>
  (req, res, next) => {
    const currentUser = { id: req.user.id };
    const requester = { id: req.params.userId };

    const { error } = tryCatchSync(() => {
      userPolicy.checkIsSamePerson({ currentUser, requester });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUpdateUsername =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const { userId } = req.params;
    const currentUser = { id: req.user.id };
    const { error: requesterError, data: requester } = await tryCatchAsync(
      async () => userService.getUserById(userId)
    );

    if (requesterError) {
      return next(requesterError);
    }

    const { error } = tryCatchSync(() => {
      userPolicy.checkUpdateUsernamePermission({ currentUser, requester });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUpdateEmail =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const { userId } = req.params;
    const currentUser = { id: req.user.id };
    const { error: requesterError, data: requester } = await tryCatchAsync(
      async () => userService.getUserById(userId)
    );

    if (requesterError) {
      return next(requesterError);
    }

    const { error } = tryCatchSync(() => {
      userPolicy.checkUpdateEmailPermission({ currentUser, requester });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUpdatePassword =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const { userId } = req.params;
    const currentUser = { id: req.user.id };
    const { error: requesterError, data: requester } = await tryCatchAsync(
      async () => userService.getUserById(userId)
    );

    if (requesterError) {
      return next(requesterError);
    }

    const { error } = tryCatchSync(() => {
      userPolicy.checkUpdatePasswordPermission({ currentUser, requester });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUpdateProfile =
  ({ userPolicy }) =>
  (req, res, next) => {
    const currentUser = { id: req.user.id };
    const requester = { id: req.params.userId };

    const { error } = tryCatchSync(() => {
      userPolicy.checkUpdateProfilePermission({ currentUser, requester });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanSendFriendRequest =
  ({ userPolicy, blockUserService, friendRequestService, friendService }) =>
  async (req, res, next) => {
    const currentUser = req.user;
    const requester = { id: req.params.userId };
    const targetUser = { id: req.body.friendId };

    const { error: invalidDataError, data } = await tryCatchAsync(async () =>
      Promise.all([
        blockUserService.getUserBlockList(requester.id),
        blockUserService.getUserBlockList(targetUser.id),
        friendRequestService.isFriendRequestExist(requester.id, targetUser.id),
        friendService.getUserFriendsById(requester.id),
      ])
    );

    if (invalidDataError) {
      return next(invalidDataError);
    }

    const [
      requesterBlockList,
      targetUserBlockList,
      hasOngoingFriendRequest,
      requesterFriends,
    ] = data;

    req.ctx = {
      ...req.ctx,
      requesterFriends,
    };

    const { error } = tryCatchSync(() =>
      userPolicy.checkSendFriendRequestPermission({
        currentUser,
        requester,
        targetUser,
        requesterBlockList,
        targetUserBlockList,
        hasOngoingFriendRequest,
        requesterFriends,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanAcceptFriendRequest =
  ({ userPolicy, friendRequestService }) =>
  async (req, res, next) => {
    const { friendRequestId } = req.params;
    const currentUser = { id: req.user.id };
    const requester = { id: req.params.userId };

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.getFriendRequestById(friendRequestId)
      );

    if (friendRequestError) {
      return next(friendRequestError);
    }

    const { error } = tryCatchSync(() =>
      userPolicy.checkAcceptFriendRequestPermission({
        currentUser,
        requester,
        friendRequest,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanDeleteFriendRequest =
  ({ userPolicy, friendRequestService }) =>
  async (req, res, next) => {
    const { friendRequestId } = req.params;
    const currentUser = req.user;
    const requester = { id: req.params.userId };

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.getFriendRequestById(friendRequestId)
      );

    if (friendRequestError) {
      return next(friendRequestError);
    }

    const { error } = tryCatchSync(() =>
      userPolicy.checkDeleteFriendRequestPermission({
        currentUser,
        requester,
        friendRequest,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUnFriendUser =
  ({ userPolicy, friendService }) =>
  async (req, res, next) => {
    const currentUser = { id: req.user.id };
    const requester = { id: req.params.userId };
    const targetUser = { id: req.params.friendId };

    const friends = await friendService.getUserFriendsById(requester.id);

    req.ctx = {
      ...req.ctx,
      requesterFriends: friends,
    };

    const { error } = tryCatchSync(() =>
      userPolicy.checkUnFriendPermission({
        currentUser,
        requester,
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
    const currentUser = req.user;
    const requester = { id: req.params.userId };
    const targetUser = { id: req.body.blockId };

    const requesterBlockList = await blockUserService.getUserBlockList(
      requester.id
    );

    req.ctx = {
      ...req.ctx,
      requesterBlockList,
    };

    const { error } = tryCatchSync(() =>
      userPolicy.checkBlockUserPermission({
        currentUser,
        requester,
        targetUser,
        requesterBlockList,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUnBlockUser =
  ({ userPolicy, blockUserService }) =>
  async (req, res, next) => {
    const currentUser = req.user;
    const requester = { id: req.params.userId };
    const targetUser = { id: req.params.unBlockId };

    const requesterBlockList = await blockUserService.getUserBlockList(
      requester.id
    );

    req.ctx = {
      ...req.ctx,
      requesterBlockList,
    };

    const { error } = tryCatchSync(() =>
      userPolicy.checkUnBlockUserPermission({
        currentUser,
        requester,
        targetUser,
        requesterBlockList,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanDeleteAccount =
  ({ userPolicy, userService }) =>
  async (req, res, next) => {
    const { userId } = req.params;
    const currentUser = { id: req.user.id };
    const { error: requesterError, data: requester } = await tryCatchAsync(
      async () => userService.getUserById(userId)
    );

    if (requesterError) {
      return next(requesterError);
    }

    const ownedChats = await userService.getUserOwnedChatsById(requester.id);

    const { error } = tryCatchSync(() =>
      userPolicy.checkDeleteAccountPermission({
        currentUser,
        requester,
        ownedChats,
      })
    );

    if (error) {
      return next(error);
    }

    return next();
  };

const createCanUnlinkGoogle =
  ({ userPolicy, openIdService }) =>
  async (req, res, next) => {
    const currentUser = { id: req.user.id };
    const requester = { id: req.params.userId };

    const { error } = await tryCatchAsync(async () => {
      const openId = await openIdService.getOpenIdByProviderAndUserId(
        "google",
        requester.id
      );

      return userPolicy.checkGoogleUnlinkPermissions({
        currentUser,
        requester,
        openId,
      });
    });

    if (error) {
      return next(error);
    }

    return next();
  };

export default (dependencies) => {
  const uploader = createUploader(dependencies);
  const isUnauthorizedUser = createIsAuthorizedUser(dependencies);
  const canUpdateUsername = createCanUpdateUsername(dependencies);
  const canUpdateEmail = createCanUpdateEmail(dependencies);
  const canUpdatePassword = createCanUpdatePassword(dependencies);
  const canUpdateProfile = createCanUpdateProfile(dependencies);
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
    isUnauthorizedUser,
    canUpdateUsername,
    canUpdateEmail,
    canUpdatePassword,
    canUpdateProfile,
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
