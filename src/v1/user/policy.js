import { success, forbidden, notFound, conflict } from "./http-responce.js";

const isDemoUser = (user) => user.accountLevel <= 0;

const denyIfDemo = (field) =>
  forbidden(`Demo user cannot update their ${field}`);
const allowUpdate = (field) => success(`You can update ${field}`);

const checkUpdatePermission = (user, field, denyDemo = true) => {
  if (isDemoUser(user) && denyDemo) {
    return denyIfDemo(field);
  }

  return allowUpdate(field);
};

const checkUpdateUsernamePermission = (user) =>
  checkUpdatePermission(user, "username");

const checkUpdateEmailPermission = (user) =>
  checkUpdatePermission(user, "email");

const checkUpdatePasswordPermission = (user) =>
  checkUpdatePermission(user, "password");

const checkUpdateProfilePermission = (user) =>
  checkUpdatePermission(user, "profile", false);

const checkSendFriendRequestPermission = (
  user,
  targetUser,
  hasPendingFriendRequest
) => {
  if (user.id === targetUser.id) {
    return forbidden("You cannot send friend request to yourself");
  }

  const isTargetBlockedByUser = user.blockedUsers.some(
    (b) => b.id === targetUser.id
  );
  const isUserBlockedByTarget = targetUser.blockedUsers.some(
    (b) => b.id === user.id
  );

  const isAlreadyFriends = user.friends.some((f) => f.id === targetUser.id);

  if (isTargetBlockedByUser) {
    return forbidden("You cannot send a friend request to a blocked user");
  }

  if (isUserBlockedByTarget) {
    return forbidden("You cannot send a friend request to this user");
  }

  if (hasPendingFriendRequest) {
    return conflict("There is a pending friend request");
  }

  if (isAlreadyFriends) {
    return conflict("You are already friends with this user");
  }

  return success("You can send a friend request to this user");
};

const checkAcceptFriendRequestPermission = (user, friendRequest) => {
  if (user.id === friendRequest.receiver.id) {
    return success("You can accept this friend request");
  }

  if (user.id === friendRequest.requester.id) {
    return forbidden("You are not authorized to accept this friend request");
  }

  return notFound("Friend request does not exist");
};

const checkDeleteFriendRequestPermission = (user, friendRequest) => {
  if (
    user.id === friendRequest.receiver.id ||
    user.id === friendRequest.requester.id
  ) {
    return success("You can delete this friend request");
  }

  return notFound("Friend request does not exist");
};

const checkUnFriendPermission = (user, targetUser) => {
  const isNotAFriend = !user.friends.some(
    (friend) => friend.id === targetUser.id
  );

  if (isNotAFriend) {
    return notFound("You are not friends with this user");
  }

  return success("You can unfriend this user");
};

const checkBlockUserPermission = (user, targetUser) => {
  if (user.id === targetUser.id) {
    return forbidden("You cannot block yourself");
  }

  const isAlreadyBlocked = user.blockedUsers.some(
    (block) => block.id === targetUser.id
  );

  if (isAlreadyBlocked) {
    return conflict("You have already blocked this user");
  }

  return success("You can block this user");
};

const checkUnBlockUserPermission = (user, targetUser) => {
  const isNotBlocked = user.blockedUsers.some(
    (block) => block.id !== targetUser.id
  );

  if (isNotBlocked) {
    return forbidden("You have not blocked this user");
  }

  return success("You can block this user");
};

const checkDeleteAccountPermission = (user) => {
  if (user.ownedChats?.length) {
    return forbidden(
      "Transfer your chats ownership before deleting your account"
    );
  }

  if (isDemoUser(user)) {
    return forbidden("Demo user cannot delete their account");
  }

  return success("You can delete the account");
};

export default {
  checkUpdateUsername: checkUpdateUsernamePermission,
  checkUpdateEmail: checkUpdateEmailPermission,
  checkUpdatePassword: checkUpdatePasswordPermission,
  checkUpdateProfile: checkUpdateProfilePermission,
  checkSendFriendRequest: checkSendFriendRequestPermission,
  checkAcceptFriendRequest: checkAcceptFriendRequestPermission,
  checkDeleteFriendRequest: checkDeleteFriendRequestPermission,
  checkUnFriend: checkUnFriendPermission,
  checkBlockUser: checkBlockUserPermission,
  checkUnBlockUser: checkUnBlockUserPermission,
  checkDeleteAccount: checkDeleteAccountPermission,
};
