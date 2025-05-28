const createBlockUser =
  ({ blockUserRepository, userService }) =>
  async ({ requesterId, receiverId }) => {
    await Promise.all([
      userService.getUserById(requesterId),
      userService.getUserById(receiverId),
    ]);

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
  async ({ requesterId, receiverId }) => {
    await Promise.all([
      userService.getUserById(requesterId),
      userService.getUserById(receiverId),
    ]);

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
