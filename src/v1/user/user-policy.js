import { httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";
import AuthError from "../../errors/auth-error.js";
import ValidationError from "../../errors/validation-error.js";

const checkIsSamePerson = ({ currentUser, requester }) => {
  const isInvalidRequest = !currentUser.id || !requester?.id;

  if (isInvalidRequest) {
    throw new ValidationError(
      "Invalid user data provided",
      null,
      httpStatus.BAD_REQUEST
    );
  }

  const isUnauthorizedUser = currentUser.id !== requester.id;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can perform this action",
  };
};

const checkUpdateUsernamePermission = (user) => {
  const isUnauthorizedUser = user.accountLevel <= 0;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can update the username",
  };
};

const checkUpdateEmailPermission = (user) => {
  const isUnauthorizedUser = user.accountLevel <= 0;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can update the email",
  };
};

const checkUpdatePasswordPermission = (user) => {
  const isUnauthorizedUser = user.accountLevel <= 0;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can update the password",
  };
};

const checkUpdateProfilePermission = ({ currentUser, requester }) => {
  const invalidRequest = !currentUser.id || !requester?.id;

  if (invalidRequest) {
    throw new ValidationError(
      "Invalid user data provided",
      null,
      httpStatus.BAD_REQUEST
    );
  }

  const isUnauthorizedUser = currentUser.id !== requester.id;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can update the profile",
  };
};

const checkSendFriendRequestPermission = ({
  user,
  targetUser,
  userBlockList,
  targetUserBlockList,
  hasOngoingFriendRequest,
  userFriends,
}) => {
  if (user.id === targetUser.id)
    throw new APIError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );

  const isTargetUserBlock = userBlockList.some(
    (block) => block.id === targetUser.id
  );

  const isRequesterBlock = targetUserBlockList.some(
    (block) => block.id === user.id
  );

  if (isTargetUserBlock) {
    throw new APIError(
      "You cannot send a friend request to a blocked user",
      httpStatus.FORBIDDEN
    );
  }

  if (isRequesterBlock) {
    throw new APIError(
      "You cannot send a friend request to this user",
      httpStatus.FORBIDDEN
    );
  }

  if (hasOngoingFriendRequest) {
    throw new APIError(
      "There is a pending friend request",
      httpStatus.CONFLICT
    );
  }

  const isAlreadyFriend = userFriends.some(
    (friend) => friend.id === targetUser.id
  );

  if (isAlreadyFriend) {
    throw new APIError(
      "You are already friend with this user",
      httpStatus.CONFLICT
    );
  }

  return {
    success: true,
    message: "You can send a friend request to this user",
  };
};

const checkAcceptFriendRequestPermission = ({ user, friendRequest }) => {
  const isNotTheReceiver = user.id !== friendRequest.receiver.id;

  if (isNotTheReceiver) {
    throw new AuthError(
      "You are not authorized to accept this friend request",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can accept this friend request",
  };
};

const checkDeleteFriendRequestPermission = ({ user, friendRequest }) => {
  const isNotTheRequesterOrReceiver =
    user.id !== friendRequest.requester.id ||
    user.id !== friendRequest.receiver.id;

  if (isNotTheRequesterOrReceiver) {
    throw new AuthError(
      "You are not authorized to delete this resource",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can delete this friend request",
  };
};

const checkUnFriendPermission = ({ targetUser, friends }) => {
  const isNotAFriend =
    friends.some((friend) => friend.id === targetUser.id) === false;

  if (isNotAFriend) {
    throw new APIError(
      "You are not friends with this user",
      httpStatus.NOT_FOUND
    );
  }

  return {
    success: true,
    message: "You can unfriend this user",
  };
};

const checkBlockUserPermission = ({ targetUser, userBlockList }) => {
  const isAlreadyBlocked = userBlockList.some(
    (block) => block.id === targetUser.id
  );

  if (isAlreadyBlocked) {
    throw new APIError(
      "You have already blocked this user",
      httpStatus.CONFLICT
    );
  }

  return {
    success: true,
    message: "You can block this user",
  };
};

const checkUnBlockUserPermission = ({ targetUser, userBlockList }) => {
  const isNotBlocked =
    userBlockList.some((block) => block.id === targetUser.id) === false;

  if (isNotBlocked) {
    throw new AuthError("You have not blocked this user", httpStatus.FORBIDDEN);
  }

  return {
    success: true,
    message: "You can unblock this user",
  };
};

const checkDeleteAccountPermission = ({ user, ownedChats }) => {
  if (ownedChats.length) {
    throw new AuthError(
      "Transfer your chats ownership before deleting your account",
      httpStatus.FORBIDDEN
    );
  }

  const isDemoUser = user.accountLevel <= 0;

  if (isDemoUser) {
    throw new APIError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can delete the account",
  };
};

const checkGoogleUnlinkPermissions = (user, openId) => {
  const hasNoGoogleAuth = !openId;

  if (hasNoGoogleAuth) {
    throw new AuthError("Google oauth does not exist", httpStatus.NOT_FOUND);
  }

  const noBackupLogin = !openId.user?.password;

  if (noBackupLogin) {
    throw new AuthError(
      "Add at least one backup login method (e.g., username/password) before unlinking.",
      httpStatus.UNPROCESSABLE
    );
  }

  return {
    success: true,
    message: "User can unlink Google.",
  };
};

export {
  checkIsSamePerson,
  checkUpdateUsernamePermission,
  checkUpdateEmailPermission,
  checkUpdatePasswordPermission,
  checkUpdateProfilePermission,
  checkSendFriendRequestPermission,
  checkAcceptFriendRequestPermission,
  checkBlockUserPermission,
  checkDeleteFriendRequestPermission,
  checkUnFriendPermission,
  checkUnBlockUserPermission,
  checkDeleteAccountPermission,
  checkGoogleUnlinkPermissions,
};
