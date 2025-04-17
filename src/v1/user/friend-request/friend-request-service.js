import { httpStatus } from "../../../constants/index.js";
import APIError from "../../../errors/api-error.js";

const createInsertFriendRequest =
  ({ friendRequestRepository, userService }) =>
  async (data) => {
    const { requesterId, receiverId, requesterFriends } = data;

    await Promise.all([
      userService.getUserById(requesterId),
      userService.getUserById(receiverId),
    ]);

    const [requesterPk, receiverPk] = await Promise.all([
      userService.getUserPkById(requesterId),
      userService.getUserPkById(receiverId),
    ]);

    if (!requesterPk || !receiverPk) {
      throw new APIError("User does not exist", httpStatus.NOT_FOUND);
    }

    const isAlreadyFriend = requesterFriends.some(
      (friend) => friend.id === receiverId
    );

    if (isAlreadyFriend) {
      throw new APIError(
        "You are already friend with this user",
        httpStatus.CONFLICT
      );
    }

    const isFriendRequestExist =
      await friendRequestRepository.isFriendRequestExist({
        requesterPk,
        receiverPk,
      });

    if (isFriendRequestExist) {
      throw new APIError(
        "There's an ongoing friend request",
        httpStatus.CONFLICT
      );
    }

    const friendRequest = await friendRequestRepository.createFriendRequest({
      requesterPk,
      receiverPk,
    });

    return friendRequest;
  };

const createGetFriendRequestByid =
  ({ friendRequestRepository }) =>
  async (id) => {
    const friendRequest =
      await friendRequestRepository.getFriendRequestById(id);

    if (!friendRequest) {
      throw new APIError("Friend request does not exist", httpStatus.NOT_FOUND);
    }

    return friendRequest;
  };

const createGetFriendRequestByUserId =
  ({ friendRequestRepository, userService }) =>
  async (userId) => {
    await userService.getUserById(userId);

    const friendRequest =
      await friendRequestRepository.getFriendRequestByUserId(userId);

    return friendRequest;
  };

const createGetFriendRequestsByUserId =
  ({ friendRequestRepository, userService }) =>
  async (userId) => {
    await userService.getUserById(userId);

    const friendRequests =
      await friendRequestRepository.getFriendRequestsByUserId(userId);

    return friendRequests;
  };

const createIsFriendRequestExist =
  ({ friendRequestRepository, userService }) =>
  async (requesterId, receiverId) => {
    const [requesterPk, receiverPk] = await Promise.all([
      userService.getUserPkById(requesterId),
      userService.getUserPkById(receiverId),
    ]);

    if (!requesterPk || !receiverPk) {
      throw new APIError("User does not exist", httpStatus.NOT_FOUND);
    }

    return friendRequestRepository.isFriendRequestExist({
      requesterPk,
      receiverPk,
    });
  };

const createDeleteFriendRequestById =
  ({ friendRequestRepository }) =>
  async (id) => {
    const isFriendRequestExist =
      await friendRequestRepository.isFriendRequestExistById(id);

    if (!isFriendRequestExist) {
      throw new APIError("Friend request not found", httpStatus.NOT_FOUND);
    }

    return friendRequestRepository.deleteFriendRequestById(id);
  };

const createDeleteFriendRequestByUserIds =
  ({ friendRequestRepository, userService }) =>
  async (requesterId, receiverId) => {
    const [requesterPk, receiverPk] = await Promise.all([
      userService.getUserPkById(requesterId),
      userService.getUserPkById(receiverId),
    ]);

    if (!requesterPk || !receiverPk) {
      throw new APIError("User does not exist", httpStatus.NOT_FOUND);
    }

    const friendRequest =
      await friendRequestRepository.getFriendRequestByUserPks({
        requesterPk,
        receiverPk,
      });

    if (!friendRequest) {
      throw new APIError("Friend request not found", httpStatus.NOT_FOUND);
    }

    return friendRequestRepository.deleteFriendRequestById(friendRequest.id);
  };

const createDeleteFriendRequests =
  ({ friendRequestRepository }) =>
  async () =>
    friendRequestRepository.deleteFriendRequests();

export default (dependencies) => {
  const createFriendRequest = createInsertFriendRequest(dependencies);

  const getFriendRequestById = createGetFriendRequestByid(dependencies);

  const getFriendRequestsByUserId =
    createGetFriendRequestsByUserId(dependencies);

  const getFriendRequestByUserId = createGetFriendRequestByUserId(dependencies);

  const isFriendRequestExist = createIsFriendRequestExist(dependencies);

  const deleteFriendRequestById = createDeleteFriendRequestById(dependencies);

  const deleteFriendRequestByUserIds =
    createDeleteFriendRequestByUserIds(dependencies);

  const deleteFriendRequests = createDeleteFriendRequests(dependencies);

  return Object.freeze({
    createFriendRequest,
    getFriendRequestById,
    getFriendRequestByUserId,
    getFriendRequestsByUserId,
    isFriendRequestExist,
    deleteFriendRequestById,
    deleteFriendRequestByUserIds,
    deleteFriendRequests,
  });
};

export { createIsFriendRequestExist };
