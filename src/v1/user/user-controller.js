import "dotenv/config";
import { unlink } from "fs/promises";
import Debug from "./debug.js";
import { tryCatchAsync } from "../helpers/index.js";
import { httpStatus } from "../../constants/index.js";

const debug = Debug.extend("controller");

const createMe =
  ({ userService, utils }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error, data: user } = await tryCatchAsync(async () =>
      userService.meById(userId)
    );

    if (error) {
      return next(error);
    }

    const cleanedUser = utils.removeFields(user, ["password"]);

    return res
      .status(httpStatus.OK)
      .json({ ...cleanedUser, email: utils.obtuseEmail(cleanedUser.email) });
  };

const createGetFriendRequest =
  ({ friendRequestService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error, data: friendRequests } = await tryCatchAsync(async () =>
      friendRequestService.getFriendRequestsByUserId(userId)
    );

    if (error) {
      return next(error);
    }

    debug("friend requests:");
    debug(friendRequests);

    return res.status(httpStatus.OK).json(friendRequests);
  };

const createSendFriendRequest =
  ({ friendRequestService }) =>
  async (req, res, next) => {
    const { id: requesterId } = req.user;
    const { friendId: receiverId } = req.body;

    const { error, data: friendRequest } = await tryCatchAsync(async () =>
      friendRequestService.createFriendRequest({
        requesterId,
        receiverId,
      })
    );

    if (error) {
      return next(error);
    }

    debug("friend request:");
    debug(friendRequest);

    return res.status(httpStatus.OK).json({ id: friendRequest.id });
  };

const createPatchUsername =
  ({ userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;
    const { username } = req.body;

    const { error, data: user } = await tryCatchAsync(async () =>
      userService.updateUsernameById(userId, username)
    );

    if (error) {
      return next(error);
    }

    return res
      .status(httpStatus.OK)
      .json({ id: user.id, username: user.username });
  };

const createPatchPassword =
  ({ userService }) =>
  async (req, res, next) => {
    const userId = req.user.id;
    const { oldPassword, currentPassword } = req.body;

    const { error } = await tryCatchAsync(async () =>
      userService.updatePasswordById(userId, oldPassword, currentPassword)
    );

    if (error) {
      return next(error);
    }

    debug("User password change success");

    return next();
  };

const createPatchProfile =
  ({ profileService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error } = await tryCatchAsync(
      async () => profileService.updateProfileByUserId(userId, req.body),
      () => {
        if (req.body.avatar || req.body.backgroundAvatar) {
          unlink(req.body?.avatar?.path || req.body?.backgroundAvatar?.path);
        }
      }
    );

    if (error) {
      return next(error);
    }

    return res.status(httpStatus.OK).json({ id: userId });
  };

const createDeleteProfileAvatar =
  ({ profileService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error } = await tryCatchAsync(async () =>
      profileService.deleteProfileAvatarByUserId(userId)
    );

    if (error) {
      return next(error);
    }

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createDeleteBackgroundAvatar =
  ({ profileService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error } = await tryCatchAsync(async () =>
      profileService.deleteBackgroundAvatarByUserId(userId)
    );

    if (error) {
      return next(error);
    }

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createAcceptFriendRequest =
  ({ friendRequestService, friendService }) =>
  async (req, res, next) => {
    const { friendRequestId } = req.params;
    /**
     * IF THE USER IS A FRIEND BEFORE TO THE REQUESTOR
     * NEED TO THINK ABOUT HOW CAN I RE-CONNECT THE USER
     * TO THE PREVIOUS CHAT TABLE
     *
     * ON A SECOND THOUGHT I DID NOT NEED TO DO THAT
     * AS I DO NOT NEED TO DELETE A DIRECT CHAT (UserOnChat)
     * WHEN THE USER UN-FRIEND OR BLOCKED A USER
     */

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.getFriendRequestById(friendRequestId)
      );

    if (friendRequestError) {
      return next(friendRequestError);
    }

    const data = {
      friendRequestId,
      requesterId: friendRequest.requester.id,
      receiverId: friendRequest.receiver.id,
    };

    const { error: friendError } = await tryCatchAsync(async () =>
      friendService.addFriend(data)
    );

    if (friendError) {
      return next(friendError);
    }

    return res.status(httpStatus.OK).json({ id: friendRequest.requester.id });
  };

const createDeleteFriendRequest =
  ({ friendRequestService }) =>
  async (req, res, next) => {
    const { friendRequestId } = req.params;

    const { error, data: friendRequest } = await tryCatchAsync(async () =>
      friendRequestService.deleteFriendRequestById(friendRequestId)
    );

    if (error) {
      return next(error);
    }

    return res.status(httpStatus.OK).json({ id: friendRequest.id });
  };

const createUnFriend =
  ({ friendService }) =>
  async (req, res, next) => {
    const { id: requesterId } = req.user;
    const { friendId: receiverId } = req.params;
    const { requesterFriends } = req.ctx;

    const data = { requesterId, receiverId, requesterFriends };

    const { error, data: users } = await tryCatchAsync(async () =>
      friendService.unFriendUser(data)
    );

    if (error) {
      return next(error);
    }

    const { receiver } = users;

    return res.status(httpStatus.OK).json({
      id: receiver.id,
    });
  };

const createBlockUser =
  ({ blockUserService, friendRequestService }) =>
  async (req, res, next) => {
    const { id: requesterId } = req.user;
    const { blockId: receiverId } = req.body;

    const data = {
      requesterId,
      receiverId,
    };

    const { error: blockUserError, data: blockUserData } = await tryCatchAsync(
      async () => blockUserService.blockUserById(data)
    );

    if (blockUserError) {
      return next(blockUserError);
    }

    const { error: friendRequestError, data: friendRequest } =
      await tryCatchAsync(async () =>
        friendRequestService.deleteFriendRequestByUserIds(
          requesterId,
          receiverId
        )
      );

    if (friendRequestError || friendRequest) {
      debug(friendRequestError || friendRequest);
    }

    const { receiver } = blockUserData;

    return res.status(httpStatus.OK).json({
      id: receiver.id,
    });
  };

const createUnBlockUser =
  ({ blockUserService }) =>
  async (req, res, next) => {
    const requesterId = req.user.id;
    const { unBlockId: receiverId } = req.params;

    const data = {
      requesterId,
      receiverId,
    };

    const { error, data: unBlockUserData } = await tryCatchAsync(async () =>
      blockUserService.unBlockUserById(data)
    );

    if (error) {
      return next(error);
    }

    const { receiver } = unBlockUserData;

    return res.status(httpStatus.OK).json({
      id: receiver.id,
    });
  };

const createDeleteAccount =
  ({ userService, cookieConfig }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const { error } = await tryCatchAsync(() =>
      userService.deleteUserById(userId)
    );

    if (error) return next(error);

    res.clearCookie("refreshToken", cookieConfig);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

const createUnlinkGoogle =
  ({ openIdService }) =>
  async (req, res, next) => {
    const userId = req.user.id;

    const data = { userId, provider: "google" };

    const { error, data: openIdData } = await tryCatchAsync(async () =>
      openIdService.deleteOpenId(data)
    );

    if (error) {
      return next(error);
    }

    debug("OpenId Connect successfully disconnected");
    debug(openIdData);

    return res.sendStatus(httpStatus.NO_CONTENT);
  };

export default (depenpendies) => {
  const me = createMe(depenpendies);

  const getFriendRequestList = createGetFriendRequest(depenpendies);

  const sendFriendRequest = createSendFriendRequest(depenpendies);

  const patchUsername = createPatchUsername(depenpendies);
  const patchPassword = createPatchPassword(depenpendies);

  const patchProfile = createPatchProfile(depenpendies);

  const acceptFriendRequest = createAcceptFriendRequest(depenpendies);

  const deleteProfileAvatar = createDeleteProfileAvatar(depenpendies);

  const deleteBackgroundAvatar = createDeleteBackgroundAvatar(depenpendies);

  const deleteFriendRequest = createDeleteFriendRequest(depenpendies);

  const unFriend = createUnFriend(depenpendies);

  const blockUser = createBlockUser(depenpendies);

  const unBlockUser = createUnBlockUser(depenpendies);

  const deleteAccount = createDeleteAccount(depenpendies);
  const unlinkGoogle = createUnlinkGoogle(depenpendies);

  return Object.freeze({
    me,
    getFriendRequestList,
    sendFriendRequest,
    patchUsername,
    patchPassword,
    patchProfile,
    acceptFriendRequest,
    deleteFriendRequest,
    unFriend,
    blockUser,
    unBlockUser,
    deleteAccount,
    unlinkGoogle,
    deleteProfileAvatar,
    deleteBackgroundAvatar,
  });
};
