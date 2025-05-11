import userRepository from "../../user-repository.js";
import friendRequestRepository from "../../friend-request/friend-request-repository.js";
import friendRepository from "../../friend/friend-repository.js";
import blockUserRepository from "../../block-user/block-user-repository.js";
import initUserService from "../../user-service.js";
import initFriendRequestService from "../../friend-request/friend-request-service.js";
import initFriendService from "../../friend/friend-service.js";
import initBlockUserService from "../../block-user/block-user-service.js";
import { hashPassword } from "../../../helpers/index.js";

const userService = initUserService({
  userRepository,
  passwordManager: { hashPassword },
});

const friendRequestService = initFriendRequestService({
  friendRequestRepository,
  userService,
});

const friendService = initFriendService({
  friendRepository,
  friendRequestService,
});

const blockUserService = initBlockUserService({
  blockUserRepository,
  userService,
});

const services = {
  user: userService,
  friendRequest: friendRequestService,
  friend: friendService,
  block: blockUserService,
};

export default services;
