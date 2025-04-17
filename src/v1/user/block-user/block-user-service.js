import { httpStatus } from "../../../constants/index.js";
import APIError from "../../../errors/api-error.js";

const createBlockUser =
  ({ blockUserRepository, userService }) =>
  async ({ requesterId, receiverId, requesterBlockList }) => {
    await Promise.all([
      userService.getUserById(requesterId),
      userService.getUserById(receiverId),
    ]);

    const isAlreadyBlocked = requesterBlockList.some(
      (block) => block.id === receiverId
    );

    if (isAlreadyBlocked) {
      throw new APIError(
        "You have already blocked this user",
        httpStatus.CONFLICT
      );
    }

    const user = await blockUserRepository.blockUser({
      requesterId,
      receiverId,
    });

    return user;
  };

const createGetUserBlockList =
  ({ blockUserRepository, userService }) =>
  async (userId) => {
    await userService.getUserById(userId);

    const blockedUsers = await blockUserRepository.findUserBlockList(userId);

    return blockedUsers;
  };

const createUnBlockUserById =
  ({ blockUserRepository, userService }) =>
  async ({ requesterId, receiverId, requesterBlockList }) => {
    await Promise.all([
      userService.getUserById(requesterId),
      userService.getUserById(receiverId),
    ]);

    const isNotBlocked =
      requesterBlockList.some((block) => block.id === receiverId) === false;

    if (isNotBlocked) {
      throw new APIError("You have not blocked this user", httpStatus.CONFLICT);
    }

    const user = await blockUserRepository.unBlockUserById({
      requesterId,
      receiverId,
    });

    return user;
  };

export default (dependencies) => {
  const blockUserById = createBlockUser(dependencies);

  const getUserBlockList = createGetUserBlockList(dependencies);

  const unBlockUserById = createUnBlockUserById(dependencies);

  return Object.freeze({ blockUserById, getUserBlockList, unBlockUserById });
};
