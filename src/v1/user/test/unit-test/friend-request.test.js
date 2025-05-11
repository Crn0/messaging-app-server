import { describe, it, expect, beforeEach } from "vitest";
import { seedDb } from "../mocks/db/index.js";
import friendRequestRepository, {
  dbClear,
} from "../mocks/repository/friend-request-repositry.js";
import initFriendRequestService from "../../friend-request/friend-request-service.js";
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

const friendRequestService = initFriendRequestService({
  friendRequestRepository,
  userService,
});

describe("Friend request service", () => {
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

  describe("createFriendRequest", () => {
    it("should create a new friend request and returns a friend request object", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterFriends: [],
      };

      const friendRequest =
        await friendRequestService.createFriendRequest(data);

      expect(friendRequest).toHaveProperty("id");
      expect(friendRequest.requester).toHaveProperty("id");
      expect(friendRequest.receiver).toHaveProperty("id");
    });

    it("should throw NotFoundError when the receiver user does not exist", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: "testid",
        requesterFriends: [],
      };

      const friendRequest = friendRequestService.createFriendRequest(data);

      await expect(friendRequest).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });

    it("should throw a ConflictError when there's a friendship between users", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterFriends: [{ id: createdUser02.data.id }],
      };

      const friendRequest = friendRequestService.createFriendRequest(data);

      await expect(friendRequest).rejects.toThrowError(
        expect.objectContaining({
          message: "You are already friend with this user",
          httpCode: 409,
        })
      );
    });

    it("should throw a ConflictError when there's a ongoing friend request", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterFriends: [],
      };

      await friendRequestService.createFriendRequest(data);

      const friendRequest = friendRequestService.createFriendRequest(data);

      await expect(friendRequest).rejects.toThrowError(
        expect.objectContaining({
          message: "There's an ongoing friend request",
          httpCode: 409,
        })
      );
    });
  });

  describe("deleteFriendRequestById", () => {
    it("should delete the friend request and returns a friend request object", async () => {
      const data = {
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterFriends: [],
      };

      const friendRequest =
        await friendRequestService.createFriendRequest(data);

      const deletedFriendRequest =
        await friendRequestService.deleteFriendRequestById(friendRequest.id);

      expect(deletedFriendRequest).toHaveProperty("id");
      expect(deletedFriendRequest.requester).toHaveProperty("id");
      expect(deletedFriendRequest.receiver).toHaveProperty("id");
    });

    it("should throw a NotfoundError when there's no ongoing friend request", async () => {
      const friendRequest =
        friendRequestService.deleteFriendRequestById("testid");

      await expect(friendRequest).rejects.toThrowError(
        expect.objectContaining({
          message: "Friend request not found",
          httpCode: 404,
        })
      );
    });
  });
});
