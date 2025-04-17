import { httpStatus } from "../../../constants/index.js";
import APIError from "../../../errors/api-error.js";

const createAddFriend =
  ({ friendRepository, friendRequestService }) =>
  async (data) => {
    const isFriendRequestExist =
      await friendRequestService.getFriendRequestById(data.friendRequestId);

    if (!isFriendRequestExist) {
      throw new APIError("Friend Request not found", httpStatus.NOT_FOUND);
    }

    return friendRepository.addFriend(data);
  };

const createUnFriend =
  ({ friendRepository }) =>
  async (data) => {
    const isReceiverNotAFriend = !data.requesterFriends.some(
      (friend) => friend.id === data.receiverId
    );

    if (isReceiverNotAFriend) {
      throw new APIError(
        "You are not friends with this user",
        httpStatus.BAD_REQUEST
      );
    }

    return friendRepository.unFriend(data);
  };

const createGetUserFriendsById =
  ({ friendRepository }) =>
  async (id) =>
    friendRepository.findUserFriendsById(id);

export default (dependencies) => {
  const addFriend = createAddFriend(dependencies);

  const unFriendUser = createUnFriend(dependencies);

  const getUserFriendsById = createGetUserFriendsById(dependencies);

  return Object.freeze({
    addFriend,
    unFriendUser,
    getUserFriendsById,
  });
};
