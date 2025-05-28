import "dotenv/config";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import blockUserRepository from "../../block-user/block-user-repository.js";
import friendRepository from "../../friend/friend-repository.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";
import { idGenerator } from "../../utils.js";

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
          payload: { blockId: idGenerator() },
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          payload: { blockId: idGenerator() },

          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          payload: { blockId: idGenerator() },
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
        const { token, payload, includeAuth } = data;
        const res = await userReq.block.post.blockUser(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    it("rejects the request when the user is blocking themselves", async () => {
      const res = await userReq.block.post.blockUser(requesterAccessToken, {
        blockId: requesterId,
      });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        code: 403,
        message: "You cannot block yourself",
      });
    });
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
          payload: { blockId: idGenerator() },
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          payload: { blockId: idGenerator() },
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          payload: { blockId: idGenerator() },
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
        const { token, payload, includeAuth } = data;
        const res = await userReq.block.post.blockUser(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(401);
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
