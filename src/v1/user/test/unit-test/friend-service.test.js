import { describe, it, expect, beforeEach } from "vitest";
import { seedDb } from "../mocks/db/index.js";
import friendRepository, {
  dbClear,
} from "../mocks/repository/friend-repository.js";
import initFriendService from "../../friend/friend-service.js";
import userFactory from "../utils/user-factory.js";

let createdUser01;
let createdUser02;

const User = userFactory();

const friendRequestService = {
  getFriendRequestById: (val) => val === 1,
};

const friendService = initFriendService({
  friendRepository,
  friendRequestService,
});

describe("Friend service", () => {
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

  describe("addFriend", () => {
    it("should return an object containing friendRequest, requester, and receiver objects", async () => {
      const data = {
        friendRequestId: 1,
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
      };

      const { friendRequest, requester, receiver } =
        await friendService.addFriend(data);

      expect(friendRequest).toHaveProperty("id");
      expect(requester).toHaveProperty("id");
      expect(requester.friends).toContainEqual({ id: receiver.id });
      expect(receiver).toHaveProperty("id");
      expect(receiver.friends).toContainEqual({ id: requester.id });
    });

    it("shoud throw a NotFoundError if there's no friend request", async () => {
      const data = {
        friendRequestId: 2,
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
      };

      await expect(friendService.addFriend(data)).rejects.toThrowError(
        expect.objectContaining({
          message: "Friend Request not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("unFriend", () => {
    it("should return both user objects after removing friendship", async () => {
      const data = {
        friendRequestId: 1,
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
      };

      await friendService.addFriend(data);

      const requesterFriends = await friendService.getUserFriendsById(
        data.requesterId
      );

      data.requesterFriends = requesterFriends;

      const { requester, receiver } = await friendService.unFriendUser(data);

      expect(requester).toHaveProperty("id");
      expect(requester).toHaveProperty("username");
      expect(requester.friends).not.toContainEqual({ id: receiver.id });
      expect(receiver).toHaveProperty("id");
      expect(receiver).toHaveProperty("username");
      expect(receiver.friends).not.toContainEqual({ id: requester.id });
    });

    it("should throw a BadrequestError when theres' no friendship between users", async () => {
      const data = {
        friendRequestId: 1,
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
        requesterFriends: [],
      };

      await expect(friendService.unFriendUser(data)).rejects.toThrowError(
        expect.objectContaining({
          message: "You are not friends with this user",
          httpCode: 400,
        })
      );
    });
  });

  describe("getUserFriendsById", () => {
    it("should return an array of user's friends", async () => {
      const data = {
        friendRequestId: 1,
        requesterId: createdUser01.data.id,
        receiverId: createdUser02.data.id,
      };

      await friendService.addFriend(data);

      const friends = await friendService.getUserFriendsById(data.requesterId);

      expect(
        friends.some((friend) => friend.id === data.receiverId)
      ).toBeTruthy();
    });
  });
});
