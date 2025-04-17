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

const checkUpdateUsernamePermission = ({ currentUser, requester }) => {
  const invalidRequest =
    !currentUser.id ||
    Number.isNaN(Number(requester.accountLevel)) ||
    !requester?.id;

  if (invalidRequest) {
    throw new AuthError("Invalid user data provided", httpStatus.BAD_REQUEST);
  }

  const isUnauthorizedUser =
    currentUser.id !== requester?.id || requester.accountLevel <= 0;

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

const checkUpdateEmailPermission = ({ currentUser, requester }) => {
  const invalidRequest =
    !currentUser.id ||
    Number.isNaN(Number(requester.accountLevel)) ||
    !requester?.id;

  if (invalidRequest) {
    throw new ValidationError(
      "Invalid user data provided",
      null,

      httpStatus.BAD_REQUEST
    );
  }

  const isUnauthorizedUser =
    currentUser.id !== requester?.id || requester.accountLevel <= 0;

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

const checkUpdatePasswordPermission = ({ currentUser, requester }) => {
  const invalidRequest =
    !currentUser.id ||
    Number.isNaN(Number(requester.accountLevel)) ||
    !requester?.id;

  if (invalidRequest) {
    throw new ValidationError(
      "Invalid user data provided",
      null,

      httpStatus.BAD_REQUEST
    );
  }

  const isUnauthorizedUser =
    currentUser.id !== requester?.id || requester.accountLevel <= 0;

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
  currentUser,
  requester,
  targetUser,
  requesterBlockList,
  targetUserBlockList,
  hasOngoingFriendRequest,
  requesterFriends,
}) => {
  const isInvalidRequest =
    !currentUser.id ||
    !requester?.id ||
    !targetUser?.id ||
    !Array.isArray(requesterBlockList) ||
    !Array.isArray(targetUserBlockList) ||
    !Array.isArray(requesterFriends) ||
    typeof hasOngoingFriendRequest !== "boolean";

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

  const isSamePerson = requester.id === targetUser.id;

  if (isSamePerson) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  const isTargetUserBlock = requesterBlockList.some(
    (block) => block.id === targetUser.id
  );

  const isRequesterBlock = targetUserBlockList.some(
    (block) => block.id === requester.id
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

  const isAlreadyFriend = requesterFriends.some(
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

const checkAcceptFriendRequestPermission = ({
  currentUser,
  requester,
  friendRequest,
}) => {
  const invalidFriendRequest = !friendRequest;

  if (invalidFriendRequest) {
    throw new APIError("Friend request does not exist", httpStatus.NOT_FOUND);
  }

  const hasMissingIds =
    !currentUser.id || !requester?.id || !friendRequest.receiver?.id;

  if (hasMissingIds) {
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

  const isNotTheReceiver = requester.id !== friendRequest.receiver.id;

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

const checkDeleteFriendRequestPermission = ({
  currentUser,
  requester,
  friendRequest,
}) => {
  const invalidFriendRequest = !friendRequest;

  if (invalidFriendRequest) {
    throw new APIError("Friend request does not exist", httpStatus.NOT_FOUND);
  }

  const hasMissingIds =
    !currentUser.id ||
    !requester?.id ||
    !friendRequest.requester?.id ||
    !friendRequest.receiver?.id;

  if (hasMissingIds) {
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

  const isNotTheRequesterOrReceiver =
    requester.id !== friendRequest.requester.id &&
    requester.id !== friendRequest.receiver.id;

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

const checkUnFriendPermission = ({
  currentUser,
  requester,
  targetUser,
  friends,
}) => {
  const isInvalidRequest =
    !currentUser.id ||
    !requester?.id ||
    !targetUser.id ||
    !Array.isArray(friends);

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

const checkBlockUserPermission = ({
  currentUser,
  requester,
  targetUser,
  requesterBlockList,
}) => {
  const invalidRequest =
    !requester?.id ||
    !targetUser?.id ||
    !currentUser?.id ||
    !Array.isArray(requesterBlockList);

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

  const isSamePerson = requester.id === targetUser.id;

  if (isSamePerson) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  const isAlreadyBlocked = requesterBlockList.some(
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

const checkUnBlockUserPermission = ({
  currentUser,
  requester,
  targetUser,
  requesterBlockList,
}) => {
  const invalidRequest =
    !requester?.id ||
    !targetUser?.id ||
    !currentUser?.id ||
    !Array.isArray(requesterBlockList);

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

  const isNotBlocked =
    requesterBlockList.some((block) => block.id === targetUser.id) === false;

  if (isNotBlocked) {
    throw new AuthError("You have not blocked this user", httpStatus.FORBIDDEN);
  }

  return {
    success: true,
    message: "You can unblock this user",
  };
};

const checkDeleteAccountPermission = ({
  currentUser,
  requester,
  ownedChats,
}) => {
  const invalidRequest =
    !currentUser.id ||
    !requester?.id ||
    Number.isNaN(Number(requester.accountLevel)) ||
    !Array.isArray(ownedChats);

  if (invalidRequest) {
    throw new ValidationError(
      "Invalid user data provided",
      null,
      httpStatus.BAD_REQUEST
    );
  }

  const isUnauthorizedUser =
    currentUser.id !== requester?.id || requester.accountLevel <= 0;

  if (isUnauthorizedUser) {
    throw new AuthError(
      "You are not authorized to perform this action",
      httpStatus.FORBIDDEN
    );
  }

  if (ownedChats.length) {
    throw new AuthError(
      "Transfer your chats ownership before deleting your account",
      httpStatus.FORBIDDEN
    );
  }

  return {
    success: true,
    message: "You can delete the account",
  };
};

const checkGoogleUnlinkPermissions = ({ currentUser, requester, openId }) => {
  const hasNoGoogleAuth = !openId;

  if (hasNoGoogleAuth) {
    throw new AuthError("Google oauth does not exist", httpStatus.NOT_FOUND);
  }

  const hasMissingIds = !currentUser?.id || !requester?.id || !openId.user?.id;

  if (hasMissingIds) {
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
