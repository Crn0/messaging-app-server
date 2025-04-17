import { describe, it, expect, beforeEach } from "vitest";
import { seedDb } from "../mocks/db/index.js";
import blockUserRepository, {
  dbClear,
} from "../mocks/repository/block-user-repository.js";
import initBlockUserService from "../../block-user/block-user-service.js";
import userFactory from "../utils/user-factory.js";

let createdUser01;
let createdUser02;

const User = userFactory();

const userService = {
  getUserById: async (id) => {
    const validIds = [createdUser01.data.id, createdUser02.data.id];

    if (!validIds.includes(id)) {
      const error = new Error("User not found");

      error.httpCode = 404;

      throw error;
    }
  },

  getUserPkById: async (id) => {
    if (createdUser01.data.id === id) return createdUser01.data.pk;
    if (createdUser02.data.id === id) return createdUser02.data.pk;

    return null;
  },
};

const blockUserService = initBlockUserService({
  blockUserRepository,
  userService,
});

describe("Block user service", () => {
  beforeEach(async () => {
    createdUser01 = await User.create(1);
    createdUser02 = await User.create(2);

    seedDb({
      testUser01: createdUser01.data,
      testUser02: createdUser02.data,
    });

    return () => {
      dbClear();
      createdUser01 = null;
      createdUser02 = null;
    };
  });

  describe("blockUserById", () => {
    it("should block the receiver and return the requester and receiver objects", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterBlockList: [],
      };

      const { requester, receiver } =
        await blockUserService.blockUserById(data);

      expect(requester).toHaveProperty("id");
      expect(requester.blockedUsers).toContainEqual({ id: data.receiverId });
      expect(receiver).toHaveProperty("id");
      expect(receiver.blockedBy).toContainEqual({ id: data.requesterId });
    });

    it("should throw ConflictError when blocking an already blocked user", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterBlockList: [{ id: createdUser02.data.id }],
      };

      const user = blockUserService.blockUserById(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "You have already blocked this user",
          httpCode: 409,
        })
      );
    });

    it("should throw NotFoundError when the receiver user does not exist", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: "testid",
        requesterBlockList: [],
      };

      const user = blockUserService.blockUserById(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("unBlockUserById", () => {
    it("should un-block the receiver and return the requester and receiver objects", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterBlockList: [{ id: createdUser02.data.id }],
      };

      const { requester, receiver } =
        await blockUserService.unBlockUserById(data);

      expect(requester).toHaveProperty("id");
      expect(receiver).toHaveProperty("id");
      expect(requester.blockedUsers).not.toContainEqual({
        id: data.receiverId,
      });
      expect(receiver.blockedBy).not.toContainEqual({
        id: data.receiverId,
      });
    });
  });
});
