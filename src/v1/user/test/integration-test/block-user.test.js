import "dotenv/config";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import blockUserRepository from "../../block-user/block-user-repository.js";
import friendRepository from "../../friend/friend-repository.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";

const User = userFactory();

const userReq = baseRequest({
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

const { id: receiverId } = user2.data;
const { id: unAuthorizedId, accessToken: unAuthorizedAccessToken } = user3.data;

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
    client.user.create({
      data: {
        ...user3.entity,
      },
    }),
  ]);

  return async () => {
    await Promise.all([
      client.user.deleteMany({
        where: { id: { in: [requesterId, receiverId, unAuthorizedId] } },
      }),
    ]);
  };
});

describe("Block user", () => {
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
        const { id, token, includeAuth } = data;
        const res = await userReq.friend.get.friendRequestList(id, token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Authorization Errors", () => {
    it.each([
      {
        scenario: "user is self blocking",
        data: {
          id: requesterId,
          token: requesterAccessToken,
          payload: { blockId: requesterId },
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not authorized to perform this action",
        },
      },
      {
        scenario: "authenticated user is not the userId",
        data: {
          id: requesterId,
          token: unAuthorizedAccessToken,
          payload: { blockId: receiverId },
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not authorized to perform this action",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { id, token, payload, includeAuth } = data;
        const res = await userReq.block.post.blockUser(id, token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Conflict Errors", () => {
    const payload = { blockId: unAuthorizedId };

    beforeAll(async () => {
      await blockUserRepository.blockUser({
        requesterId,
        receiverId: unAuthorizedId,
      });

      return async () => {
        await blockUserRepository.unBlockUserById({
          requesterId,
          receiverId: unAuthorizedId,
        });
      };
    });

    it("rejects the block request when blocking a blocked user", async () => {
      const res = await userReq.block.post.blockUser(
        requesterId,
        requesterAccessToken,
        payload
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 409,
        message: "You have already blocked this user",
      });
    });
  });

  describe("Success Case", () => {
    const payload = { blockId: receiverId };

    it("returns 200 (OK) with the blocked user id", async () => {
      const res = await userReq.block.post.blockUser(
        requesterId,
        requesterAccessToken,
        payload
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: payload.blockId });

      const blockList =
        await blockUserRepository.findUserBlockList(requesterId);

      expect(blockList).toContainEqual(
        expect.objectContaining({ id: payload.blockId })
      );

      await blockUserRepository.unBlockUserById({
        requesterId,
        receiverId: payload.blockId,
      });
    });
  });
});

describe("Unblock user", () => {
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
        const { id, token, includeAuth } = data;
        const res = await userReq.friend.get.friendRequestList(id, token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Authorization Errors", () => {
    it.each([
      {
        scenario: "authenticated user is not the userId",
        data: {
          id: requesterId,
          unBlockId: receiverId,
          token: unAuthorizedAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not authorized to perform this action",
        },
      },
      {
        scenario: "user is unblocking a non-blocked user",
        data: {
          id: requesterId,
          unBlockId: receiverId,
          token: requesterAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You have not blocked this user",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { id, unBlockId, token, payload, includeAuth } = data;
        const res = await userReq.block.delete.unBlockUser(
          id,
          unBlockId,
          token,
          payload,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Conflict Errors", () => {
    const payload = { blockId: unAuthorizedId };

    beforeAll(async () => {
      await blockUserRepository.blockUser({
        requesterId,
        receiverId: unAuthorizedId,
      });

      return async () => {
        await blockUserRepository.unBlockUserById({
          requesterId,
          receiverId: unAuthorizedId,
        });
      };
    });

    it("rejects the block request when blocking a blocked user", async () => {
      const res = await userReq.block.post.blockUser(
        requesterId,
        requesterAccessToken,
        payload
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 409,
        message: "You have already blocked this user",
      });
    });
  });

  describe("Success Case", () => {
    beforeAll(async () => {
      await blockUserRepository.blockUser({
        requesterId,
        receiverId,
      });
    });

    it("returns 200 (OK) and the un-blocked user id", async () => {
      const res = await userReq.block.delete.unBlockUser(
        requesterId,
        receiverId,
        requesterAccessToken
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: receiverId,
      });
    });
  });
});
