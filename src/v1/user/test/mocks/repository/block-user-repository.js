import db from "../db/index.js";
import { toEntity } from "../../../block-user/block-user-mapper.js";

const dbClear = () => {
  db.clear();
};

const blockUser = async ({ requesterId, receiverId }) => {
  const requester = db.get(requesterId);
  const receiver = db.get(receiverId);

  requester.blockedUsers.push({ id: receiverId });
  receiver.blockedBy.push({ id: requesterId });

  db.set(requester, {
    ...requester,
  });

  db.set(requester, {
    ...db.get(requesterId),
    friends: db
      .get(requesterId)
      .friends.filter((friend) => friend.id !== receiverId),
  });

  db.set(requester, {
    ...receiver,
    friends: receiver.friends.filter((friend) => friend.id !== requesterId),
  });

  return {
    requester: toEntity(db.get(requesterId)),
    receiver: toEntity(receiver),
  };
};

const unBlockUserById = async ({ requesterId, receiverId }) => {
  const oldRequesterData = db.get(requesterId);
  const oldReceiverData = db.get(receiverId);

  const newRequesterData = {
    ...oldReceiverData,
    blockedUsers: oldRequesterData.blockedUsers.filter(
      (block) => block.id === receiverId
    ),
    updatedAt: new Date(),
  };

  const newReceiverData = {
    ...oldReceiverData,
    blockedBy: oldRequesterData.blockedBy.filter(
      (block) => block.id === requesterId
    ),
    updatedAt: new Date(),
  };

  db.set(requesterId, {
    ...newRequesterData,
  });

  db.set(requesterId, {
    ...newReceiverData,
  });

  return {
    requester: toEntity(newRequesterData),
    receiver: toEntity(newReceiverData),
  };
};

export default { blockUser, unBlockUserById };
export { dbClear };
