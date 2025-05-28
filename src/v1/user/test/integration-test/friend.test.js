import "dotenv/config";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import userFactory from "../utils/user-factory.js";
import friendRequestRepository from "../../friend-request/friend-request-repository.js";
import friendRepository from "../../friend/friend-repository.js";
import baseRequest from "../utils/base-request.js";

const User = userFactory();

const userReq1 = baseRequest({
  request: request.agent(app),
  url: "/api/v1",
});
const userReq2 = baseRequest({
  request: request.agent(app),
  url: "/api/v1",
});

const user1 = await User.create(1);
const user2 = await User.create(1);
const user3 = await User.create(1);

const {
  expiredToken,
  invalidToken,
  id: requesterId,
  accessToken: requesterAccessToken,
} = user1.data;
const { id: receiverId, accessToken: receiverAccessToken } = user2.data;
const { id: unAuthorizedId, accessToken: unAuthorizedAccessToken } = user3.data;

const payload = { friendId: receiverId };

beforeAll(async () => {
  await client.$transaction([
    client.user.create({
      data: {
        ...user1.entity,
      },
    }),
    client.user.create({
      data: {
        ...user2.entity,
      },
    }),
  ]);

  return async () => {
    await Promise.all([
      client.user.deleteMany({
        where: { id: { in: [requesterId, receiverId] } },
      }),
    ]);
  };
});

describe("Send friend request", () => {
  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          token: requesterAccessToken,
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq1.friend.get.friendRequestList(token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    it.each([
      {
        scenario: "user is sending friend request to itself",
        data: {
          token: requesterAccessToken,
          payload: { friendId: requesterId },
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot send friend request to yourself",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { token, payload: payLoad, includeAuth } = data;
        const res = await userReq1.friend.post.sendFriendRequest(
          token,
          payLoad,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the friend request id", async () => {
      const res = await userReq1.friend.post.sendFriendRequest(
        requesterAccessToken,
        payload
      );

      expect(res.status).toBe(200);

      const { id } = res.body;

      await expect(
        client.friendRequest.findUnique({ where: { id } })
      ).resolves.toBeDefined();

      await friendRequestRepository.deleteFriendRequestById(id);
    });
  });

  describe.skip("Conflict Errors", () => {
    it("rejects the friend request when there's a pending request", async () => {
      const friendRequestRes = await userReq1.friend.post.sendFriendRequest(
        requesterId,
        requesterAccessToken,
        payload
      );

      const friendRequestId = friendRequestRes.body.id;

      const res = await userReq1.friend.post.sendFriendRequest(
        requesterId,
        requesterAccessToken,
        payload
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: "There is a pending friend request",
        errors: null,
        code: 409,
      });

      await friendRequestRepository.deleteFriendRequestById(friendRequestId);
    });
  });
});

describe("Friend request details", () => {
  let friendRequestId;

  beforeAll(async () => {
    const res = await userReq1.friend.post.sendFriendRequest(
      requesterAccessToken,
      payload
    );

    friendRequestId = res.body.id;

    return async () => {
      await friendRequestRepository.deleteFriendRequestById(friendRequestId);
    };
  });

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          id: requesterId,
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          id: requesterId,

          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          id: requesterId,

          token: requesterAccessToken,
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq1.friend.get.friendRequestList(token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and array of the user's friend request", async () => {
      const res =
        await userReq1.friend.get.friendRequestList(requesterAccessToken);

      expect(res.status).toBe(200);

      expect(res.body).toContainEqual(
        expect.objectContaining({
          id: friendRequestId,
          requester: {
            id: requesterId,
            username: user1.data.username,
            profile: {
              avatar: null,
            },
          },
          receiver: {
            id: receiverId,
            username: user2.data.username,
            profile: {
              avatar: null,
            },
          },
        })
      );
    });
  });
});

describe.only("Delete friend request", () => {
  let friendRequestId;

  beforeAll(async () => {
    const res = await userReq1.friend.post.sendFriendRequest(
      requesterAccessToken,
      payload
    );

    friendRequestId = res.body.id;
  });

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq1.friend.get.friendRequestList(token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Not Found Errors", () => {
    it.each([
      {
        scenario: "user is not the requester nor the receiver",
        data: {
          token: unAuthorizedAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 404,
          message: "Friend request does not exist",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq2.friend.patch.acceptFriendRequest(
          friendRequestId,
          token,
          {},
          { includeAuth }
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the deleted friend request id", async () => {
      const res = await userReq1.friend.delete.deleteFriendRequest(
        friendRequestId,
        requesterAccessToken
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: friendRequestId,
      });
    });
  });
});

describe("Accept friend request", () => {
  let friendRequestId;

  beforeAll(async () => {
    const res = await userReq1.friend.post.sendFriendRequest(
      requesterAccessToken,
      payload
    );

    friendRequestId = res.body.id;
  });

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          id: requesterId,
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq1.friend.get.friendRequestList(token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    it.each([
      {
        scenario: "user is not the receiver",
        data: {
          id: requesterId,
          token: requesterAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not authorized to accept this friend request",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq2.friend.patch.acceptFriendRequest(
          friendRequestId,
          token,
          {},
          { includeAuth }
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the friend id", async () => {
      const res = await userReq2.friend.patch.acceptFriendRequest(
        receiverId,
        friendRequestId,
        receiverAccessToken,
        {}
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: requesterId });

      const friends = await friendRepository.findUserFriendsById(receiverId);
      const deletedFriendRequest =
        await friendRequestRepository.getFriendRequestById(friendRequestId);

      expect(deletedFriendRequest).toBeNull();
      expect(friends).toContainEqual(
        expect.objectContaining({ id: requesterId })
      );
    });
  });
});

describe("Unfriend user", () => {
  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          id: requesterId,
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          id: requesterId,
          token: expiredToken,
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;
        const res = await userReq1.friend.get.friendRequestList(token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the un-friend user id", async () => {
      const res = await userReq2.friend.delete.unFriendUser(
        requesterId,
        receiverId,
        requesterAccessToken
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: receiverId });

      const friends = await friendRepository.findUserFriendsById(requesterId);

      expect(friends).not.toContainEqual(
        expect.objectContaining({ id: requesterId })
      );
    });
  });
});
