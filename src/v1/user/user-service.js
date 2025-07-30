import { env, httpStatus } from "../../constants/index.js";
import ValidationError from "../../errors/validation-error.js";
import APIError from "../../errors/api-error.js";
import StorageError from "../../errors/storage-error.js";

const deleteUserAvatars = async ({ profileService, user, storage }) => {
  const { avatar, backgroundAvatar } = user.profile || {};

  if (!avatar && !backgroundAvatar) return;

  const avatarPath = `${env.CLOUDINARY_ROOT_NAME}/avatars/${user.id}`;

  try {
    await storage.destroyFolder(avatarPath);

    await Promise.all([
      profileService.deleteProfileAvatarByUserId(user.id),
      profileService.deleteBackgroundAvatarByUserId(user.id),
    ]);
  } catch (e) {
    if (e instanceof StorageError && e.httpCode !== 404) throw e;
  }
};

const deleteUserAttachments = async ({ chatService, user, storage }) => {
  const messages = await chatService.getUserMessagesById(user.id);

  if (messages.length === 0) return;

  const attachmentIds = messages.flatMap((message) =>
    message.attachments.map((attachment) => attachment.id)
  );

  try {
    await Promise.all(attachmentIds.map((id) => storage.destroyFile(id)));
  } catch (e) {
    if (e instanceof StorageError && e.httpCode !== 404) throw e;
  }

  await Promise.all(
    messages.map(async (message) =>
      chatService.deleteMessageById(message.chatId, message.id)
    )
  );
};

const createInsertUser =
  ({ userRepository, passwordManager }) =>
  async (data) => {
    const dataRef = data;

    const usernameExist = await userRepository.findUserByUsername(
      dataRef.username
    );

    if (usernameExist) {
      throw new ValidationError(
        "Validation Error",
        [
          {
            code: "custom",
            message:
              "Username is unavailable. Try adding numbers, underscores _. or periods.",
            path: ["username"],
          },
        ],
        httpStatus.CONFLICT
      );
    }

    const hash = await passwordManager.hashPassword(dataRef.password);

    if (Number.isNaN(Number(dataRef.accountLevel))) {
      dataRef.accountLevel = 1;
    }

    dataRef.password = hash;

    const user = await userRepository.createUser(dataRef);

    return user;
  };

const createGetUserPkbyId =
  ({ userRepository }) =>
  async (id) => {
    const userPk = await userRepository.findUserPkById(id);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    return userPk;
  };

const createMeById =
  ({ userRepository }) =>
  async (id) => {
    const user = await userRepository.findMeById(id);

    if (!user) throw new APIError("User not found", httpStatus.NOT_FOUND);

    return user;
  };

const createGetUserById =
  ({ userRepository }) =>
  async (id) => {
    const user = await userRepository.findUserById(id);

    if (!user) throw new APIError("User not found", httpStatus.NOT_FOUND);

    return user;
  };

const createGetUserByUsername =
  ({ userRepository }) =>
  async (username) => {
    const user = await userRepository.findUserByUsername(username);

    return user;
  };

const createGetUserByEmail =
  ({ userRepository }) =>
  async (email) => {
    const user = await userRepository.findUserByEmail(email);

    return user;
  };

const createGetUsersPkbyId =
  ({ userRepository }) =>
  async (userIds) => {
    if (!Array.isArray(userIds)) {
      throw new Error(`expected "userIds" to be a array received ${userIds}`);
    }

    const userPks = await userRepository.findUsersPkById(userIds);

    return userPks;
  };

const createGetUserOwnedChatById =
  ({ userRepository }) =>
  async (userIds) => {
    const chats = await userRepository.findUserOwnedChatsById(userIds);

    return chats;
  };

const createUpdateUsernameById =
  ({ userRepository }) =>
  async (id, username) => {
    // check if user exist, if not it will throw an error
    const userExist = await userRepository.findUserById(id);

    if (!userExist) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const usernameExist = await userRepository.findUserByUsername(username);

    if (usernameExist && usernameExist.id !== id) {
      throw new ValidationError(
        "Validation Error",
        [
          {
            code: "custom",
            message:
              "Username is unavailable. Try adding numbers, underscores _. or periods.",
            path: ["username"],
          },
        ],
        httpStatus.CONFLICT
      );
    }

    const user = await userRepository.updateUsernameById(id, username);

    return user;
  };

const createUpdateEmailById =
  ({ userRepository }) =>
  async (id, email) => {
    // check if user exist, if not it will throw an error
    const userExist = await userRepository.findUserById(id);

    if (!userExist) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const emailExist = await userRepository.findUserByEmail(email);

    if (emailExist && emailExist.id !== id) {
      throw new ValidationError(
        "Validation Error",
        [
          {
            code: "custom",
            message: "Email is unavailable",
            path: ["email"],
          },
        ],
        httpStatus.CONFLICT
      );
    }

    const user = await userRepository.updateEmailById(id, email);

    return user;
  };

const createUpdatePasswordById =
  ({ userRepository, passwordManager }) =>
  async (id, oldPassword, currentPassword) => {
    // check if user exist, if not it will throw an error
    const userExist = await userRepository.findUserById(id);

    if (!userExist) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const passwordVerified = await passwordManager.verifyPassword(
      userExist.password,
      oldPassword
    );

    if (!passwordVerified) {
      throw new ValidationError(
        "Validation Error",
        [
          {
            code: "custom",
            message: "The old password provided is incorrect",
            path: ["oldPassword"],
          },
        ],
        httpStatus.UNPROCESSABLE
      );
    }

    const hash = await passwordManager.hashPassword(currentPassword);

    const user = await userRepository.updatePasswordById(id, hash);

    return user;
  };

const createDeleteUserById =
  ({ userRepository, openIdService, profileService, chatService, storage }) =>
  async (userId) => {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const openIds = await openIdService.getOpenIdsByUserId(userId);

    if (openIds.length) {
      await Promise.all(
        openIds.map(async ({ provider }) =>
          openIdService.deleteOpenId({ provider, userId })
        )
      );
    }

    await deleteUserAvatars({ profileService, user, storage });
    await deleteUserAttachments({ chatService, user, storage });

    return userRepository.deleteUserById(user.id);
  };

const createDeleteUsers =
  ({ userRepository }) =>
  async () => {
    const users = await userRepository.deleteUsers();

    return users;
  };

export default (dependencies) => {
  const createUser = createInsertUser(dependencies);

  const meById = createMeById(dependencies);

  const getUserPkById = createGetUserPkbyId(dependencies);
  const getUserById = createGetUserById(dependencies);
  const getUserByUsername = createGetUserByUsername(dependencies);
  const getUserByEmail = createGetUserByEmail(dependencies);
  const getUsersPkById = createGetUsersPkbyId(dependencies);
  const getUserOwnedChatsById = createGetUserOwnedChatById(dependencies);

  const updateUsernameById = createUpdateUsernameById(dependencies);
  const updateEmailById = createUpdateEmailById(dependencies);
  const updatePasswordById = createUpdatePasswordById(dependencies);

  const deleteUserById = createDeleteUserById(dependencies);
  const deleteUsers = createDeleteUsers(dependencies);

  return Object.freeze({
    createUser,
    meById,
    getUserPkById,
    getUserById,
    getUserByUsername,
    getUserByEmail,
    getUsersPkById,
    getUserOwnedChatsById,
    updateUsernameById,
    updateEmailById,
    updatePasswordById,
    deleteUserById,
    deleteUsers,
  });
};

export {
  createInsertUser,
  createGetUserById,
  createGetUserByUsername,
  createGetUserByEmail,
  createGetUserPkbyId,
};
