import client from "../../../db/client.js";
import { toData, toEntity } from "./block-user-mapper.js";

const include = {
  blockedUsers: true,
  blockedBy: true,
};

const blockUser = async ({ requesterId, receiverId }) => {
  const requesterData = toData("block:user", { id: receiverId });

  const requesterUnfriendData = toData("remove:friend", { id: receiverId });
  const receiverUnFriendData = toData("remove:friend", { id: requesterId });

  const requesterToBlock = client.user.update({
    include,
    where: {
      id: requesterId,
    },
    data: requesterData,
  });

  const requesterUnFriend = client.user.update({
    where: {
      id: requesterId,
    },
    data: requesterUnfriendData,
  });

  const receiverUnFriend = client.user.update({
    include,
    where: {
      id: receiverId,
    },
    data: receiverUnFriendData,
  });

  const [requester, _, receiver] = await client.$transaction([
    requesterToBlock,
    requesterUnFriend,
    receiverUnFriend,
  ]);

  return {
    requester: toEntity(requester),
    receiver: toEntity(receiver),
  };
};

const findUserBlockList = async (id) => {
  const blockList = await client.user.findMany({
    where: {
      NOT: {
        id,
      },
      blockedBy: {
        some: {
          id,
        },
      },
    },

    select: {
      id: true,
    },
  });

  return blockList;
};

const unBlockUserById = async ({ requesterId, receiverId }) => {
  const requesterUser = client.user.update({
    include,

    where: {
      id: requesterId,
    },
    data: {
      blockedUsers: {
        disconnect: {
          id: receiverId,
        },
      },
    },
  });

  const receiverUser = client.user.update({
    include,
    where: {
      id: receiverId,
    },
    data: {
      blockedBy: {
        disconnect: {
          id: requesterId,
        },
      },
    },
  });

  const [requester, receiver] = await client.$transaction([
    requesterUser,
    receiverUser,
  ]);

  return { requester: toEntity(requester), receiver: toEntity(receiver) };
};

export default { blockUser, findUserBlockList, unBlockUserById };
