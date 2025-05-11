import { describe, it, expect, beforeEach } from "vitest";
import db, { seedDb } from "../mocks/db/index.js";
import profileRepository, {
  dbClear,
} from "../mocks/repository/profile-repository.js";
import initProfileService from "../../profile/profile-service.js";
import {
  testId,
  testUser01,
  testFile01,
  testAvatar01,
  testBackgroundAvatar01,
  testFile02,
} from "../mocks/data.js";

import userFactory from "../utils/user-factory.js";

let createdUser01;

const User = userFactory();

const userService = {
  getUserPkById: async (id) => {
    if (createdUser01.data.id === id) return createdUser01.data.id;

    return null;
  },
};

const storage = {
  upload: async (_, path) =>
    path === "avatar" ? testAvatar01 : testBackgroundAvatar01,
};

const profileService = initProfileService({
  profileRepository,
  userService,
  storage,
});

describe("User Profile service", () => {
  beforeEach(async () => {
    createdUser01 = await User.create(1);

    seedDb({
      testUser01: createdUser01.data,
    });

    return () => {
      dbClear();
      createdUser01 = null;
    };
  });

  describe("updateDisplayNameByUserId", () => {
    it("should update the user profile's displayName and return the updated user object", async () => {
      const data = {
        userId: createdUser01.data.id,
        displayName: "krno",
      };

      const user = await profileService.updateDisplayNameByUserId(data);

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("profile");
      expect(user).toHaveProperty("updatedAt");
      expect(user.updatedAt).instanceOf(Date);
      expect(user.profile.displayName).toBe(data.displayName);
    });

    it("should throw a NotFoundError for non-existent user IDs", async () => {
      const data = {
        userId: testId,
        displayName: "krno",
      };

      const user = profileService.updateDisplayNameByUserId(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("updateAboutMeByUserId", () => {
    it("should update the user profile's aboutMe and return the updated profile", async () => {
      const data = {
        userId: createdUser01.data.id,
        aboutMe: "I am krno :)",
      };

      const user = await profileService.updateAboutMeByUserId(data);

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("profile");
      expect(user).toHaveProperty("updatedAt");
      expect(user.updatedAt).instanceOf(Date);
      expect(user.profile.aboutMe).toBe(data.aboutMe);
    });

    it("should throw a NotFoundError for non-existent user IDs", async () => {
      const data = {
        userId: testId,
        displayName: "krno",
      };

      const user = profileService.updateDisplayNameByUserId(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("updateProfileAvatarByUserId", () => {
    it("should update the user profile's avatar and return the updated profile", async () => {
      const data = {
        userId: createdUser01.data.id,
        file: testFile01,
      };

      const user = await profileService.updateProfileAvatarByUserId(data);

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("profile");
      expect(user).toHaveProperty("updatedAt");
      expect(user.updatedAt).instanceOf(Date);
      expect(user.profile.avatar.id).toBe(testAvatar01.public_id);
      expect(user.profile.avatar.url).toBe(testAvatar01.secure_url);
    });

    it("should throw a NotFoundError for non-existent user IDs", async () => {
      const data = {
        userId: testId,
        file: testFile01,
      };

      const user = profileService.updateProfileAvatarByUserId(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("updateBackgroundAvatarByUserId", () => {
    it("should update the user profile's backgroundAvatar and return the updated profile", async () => {
      const data = {
        userId: createdUser01.data.id,
        file: testFile02,
      };

      const user = await profileService.updateBackgroundAvatarByUserId(data);

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("profile");
      expect(user).toHaveProperty("updatedAt");
      expect(user.updatedAt).instanceOf(Date);
      expect(user.profile.backgroundAvatar.id).toBe(
        testBackgroundAvatar01.public_id
      );
      expect(user.profile.backgroundAvatar.url).toBe(
        testBackgroundAvatar01.secure_url
      );
    });

    it("should throw a NotFoundError for non-existent user IDs", async () => {
      const data = {
        userId: testId,
        file: testFile02,
      };

      const user = profileService.updateProfileAvatarByUserId(data);

      await expect(user).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });
});
