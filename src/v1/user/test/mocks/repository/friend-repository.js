import db from "../db/index.js";
import { toEntity } from "../../../friend/friend-mapper.js";

const dbClear = () => {
  db.clear();
};

const addFriend = async ({ friendRequestId, requesterId, receiverId }) => {
  if (friendRequestId !== 1) {
    throw new Error("Record to delete does not exist");
  }

  const oldRequesterData = db.get(requesterId);
  const oldreceiverData = db.get(receiverId);

  if (!oldRequesterData || !oldreceiverData) {
    throw new Error("Record to update not found");
  }

  if (!Array.isArray(oldRequesterData.friends)) {
    oldRequesterData.friends = [];
  }

  if (!Array.isArray(oldreceiverData.friends)) {
    oldreceiverData.friends = [];
  }

  const deletedFriendRequest = { id: friendRequestId };

  db.set(requesterId, {
    ...oldRequesterData,
    friends: oldRequesterData.friends.concat({ id: receiverId }),
  });

  db.set(receiverId, {
    ...oldreceiverData,
    friends: oldreceiverData.friends.concat({ id: requesterId }),
  });

  const requester = db.get(requesterId);

  const receiver = db.get(receiverId);

  return {
    requester: toEntity(requester),
    receiver: toEntity(receiver),
    friendRequest: deletedFriendRequest,
  };
};

const unFriend = async ({ requesterId, receiverId }) => {
  const oldRequesterData = db.get(requesterId);
  const oldreceiverData = db.get(receiverId);

  db.set(requesterId, {
    ...oldRequesterData,
    friends: oldRequesterData.friends.filter(
      (friend) => friend.id !== receiverId
    ),
  });

  db.set(receiverId, {
    ...oldreceiverData,
    friends: oldreceiverData.friends.filter(
      (friend) => friend.id !== requesterId
    ),
  });

  const requester = db.get(requesterId);

  const receiver = db.get(receiverId);
  return { requester: toEntity(requester), receiver: toEntity(receiver) };
};

const findUserFriendsById = async (id) => {
  const { friends } = db.get(id);

  return friends.map(toEntity);
};

export default {
  addFriend,
  unFriend,
  findUserFriendsById,
};
export { dbClear };
