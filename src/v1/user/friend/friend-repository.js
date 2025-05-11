import client from "../../../db/client.js";
import { toData, toEntity } from "./friend-mapper.js";

const addFriend = async ({ friendRequestId, requesterId, receiverId }) => {
  const requesterUserData = toData("add:friend", { id: receiverId });
  const requestedUserData = toData("add:friend", { id: requesterId });

  const deleteFriendRequest = client.friendRequest.delete({
    where: {
      id: friendRequestId,
    },
  });

  const requesterUser = client.user.update({
    where: {
      id: requesterId,
    },
    data: requesterUserData,
    select: { username: true, friends: { select: { username: true } } },
  });

  const receiverUser = client.user.update({
    where: {
      id: receiverId,
    },
    data: requestedUserData,
    select: { username: true, friends: { select: { username: true } } },
  });

  const [friendRequest, requester, receiver] = await client.$transaction([
    deleteFriendRequest,
    requesterUser,
    receiverUser,
  ]);

  return {
    friendRequest: {
      id: friendRequest.id,
    },
    requester: toEntity(requester),
    receiver: toEntity(receiver),
  };
};

const unFriend = async ({ requesterId, receiverId }) => {
  const requesterUserData = toData("remove:friend", { id: receiverId });
  const requestedUserData = toData("remove:friend", { id: requesterId });

  const requesterUser = client.user.update({
    where: {
      id: requesterId,
    },
    data: requesterUserData,
    select: {
      id: true,
      username: true,
      friends: { select: { id: true, username: true } },
    },
  });

  const receiverUser = client.user.update({
    where: {
      id: receiverId,
    },
    data: requestedUserData,
    select: {
      id: true,
      username: true,
      friends: { select: { id: true, username: true } },
    },
  });

  const [requester, receiver] = await client.$transaction([
    requesterUser,
    receiverUser,
  ]);

  return { requester: toEntity(requester), receiver: toEntity(receiver) };
};

const findUserFriendsById = async (id) => {
  const friends = await client.user.findMany({
    where: {
      NOT: {
        id,
      },
      OR: [
        {
          friends: {
            some: {
              id,
            },
          },
        },
        {
          friendsOf: {
            some: {
              id,
            },
          },
        },
      ],
    },
    include: {
      profile: {
        include: {
          avatar: {
            select: {
              images: {
                select: {
                  url: true,
                  size: true,
                  format: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return friends.map(toEntity);
};

export default { addFriend, unFriend, findUserFriendsById };
