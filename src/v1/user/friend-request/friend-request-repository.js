import client from "../../../db/client.js";
import { toData, toEntity } from "./friend-request-mapper.js";
import include from "./include.js";

const createFriendRequest = async ({ requesterPk, receiverPk }) => {
  const data = toData({ requesterPk, receiverPk });

  const friendRequest = await client.friendRequest.create({
    data,
    include,
  });

  return toEntity(friendRequest);
};

const getFriendRequestById = async (id) => {
  const friendRequest = await client.friendRequest.findUnique({
    include,
    where: {
      id,
    },
  });

  return toEntity(friendRequest);
};

const getFriendRequestsByUserId = async (userId) => {
  const friendRequests = await client.friendRequest.findMany({
    include,
    where: {
      OR: [{ receiver: { id: userId } }, { requester: { id: userId } }],
    },
  });

  return friendRequests.map(toEntity);
};

const getFriendRequestByUserPks = async ({ requesterPk, receiverPk }) => {
  const friendRequest = await client.friendRequest.findFirst({
    where: {
      OR: [
        {
          requesterPk,
          receiverPk,
        },
        {
          requesterPk: receiverPk,
          receiverPk: requesterPk,
        },
      ],
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return friendRequest;
};

const isFriendRequestExist = async ({ requesterPk, receiverPk }) => {
  const friendRequest = await client.friendRequest.findFirst({
    where: {
      OR: [
        {
          requesterPk: receiverPk,
          receiverPk: requesterPk,
        },
        {
          requesterPk,
          receiverPk,
        },
      ],
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  if (!friendRequest) return false;

  return true;
};

const isFriendRequestExistById = async (id) => {
  const friendRequest = await client.friendRequest.findUnique({
    where: {
      id,
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  if (!friendRequest) {
    return false;
  }

  return true;
};

const deleteFriendRequestById = async (id) => {
  const t = await getFriendRequestById(id);

  const friendRequest = await client.friendRequest.delete({
    include,
    where: {
      id: t.id,
    },
  });

  return toEntity(friendRequest);
};

const deleteFriendRequestByRequesterAndReceiverPk = async ({
  requesterPk,
  receiverPk,
}) => {
  const friendRequest = await client.friendRequest.delete({
    where: {
      OR: [
        {
          requesterPk_receiverPk: {
            requesterPk,
            receiverPk,
          },
        },
      ],
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return toEntity(friendRequest);
};

const deleteFriendRequests = async () => client.friendRequest.deleteMany({});

export default {
  createFriendRequest,
  getFriendRequestById,
  getFriendRequestsByUserId,
  getFriendRequestByUserPks,
  isFriendRequestExist,
  isFriendRequestExistById,
  deleteFriendRequestById,
  deleteFriendRequestByRequesterAndReceiverPk,
  deleteFriendRequests,
};
