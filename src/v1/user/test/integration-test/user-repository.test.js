import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import userRepository from "../../user-repository.js";
import userFactory from "../utils/user-factory.js";
import { testId } from "../mocks/data.js";

const User = userFactory();

const normalUser1 = await User.create(1);
const demoUser1 = await User.create(0);

beforeAll(async () => {
  await client.$transaction([
    client.user.create({
      data: {
        ...normalUser1.entity,
      },
    }),
    client.user.create({
      data: {
        ...demoUser1.entity,
      },
    }),
  ]);

  return async () => {
    await client.user.deleteMany({
      where: { id: { in: [normalUser1.data.id, demoUser1.data.id] } },
    });
  };
});

describe("User repository", () => {
  describe("createUser", () => {
    it("should create a new user and return a user object with expected properties", async () => {
      const username = "create_new_user";

      const createdUser = await userRepository.createUser({ username });

      expect(createdUser).toHaveProperty("id");
      expect(createdUser).toHaveProperty("username");

      await userRepository.deleteUserById(createdUser.id);
    });

    it("should throw a ConflictError if the username is already taken", async () => {
      const { username, password } = normalUser1.data;

      const duplicateUser = userRepository.createUser({
        username,
        password,
      });

      await expect(duplicateUser).rejects.toThrowError();
    });

    it("should throw a DatabaseError when username is null", async () => {
      const username = null;
      const password = "password";

      const createdUser = userRepository.createUser({
        username,
        password,
      });

      await expect(createdUser).rejects.toThrowError();
    });
  });

  describe("findMeById", () => {
    it("should return null if the user does not exist", async () => {
      const userMe = await userRepository.findMeById(testId, {
        friends: true,
        chats: true,
      });

      expect(userMe).toBeNull();
    });

    it("should throw a DatabaseError when id is not a valid uuid", async () => {
      const userMe = userRepository.findMeById("");

      await expect(userMe).rejects.toThrowError();
    });
  });

  describe("findUserById", () => {
    it("should return a user object when the user exists", async () => {
      const { id } = normalUser1.data;

      const userById = await userRepository.findUserById(id);

      expect(userById.id).toBe(id);
    });

    it("should return null if the user does not exist", async () => {
      const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

      const userMe = await userRepository.findUserById(id);

      expect(userMe).toBeNull();
    });

    it("should throw a DatabaseError when id is not a valid uuid", async () => {
      const userMe = userRepository.findUserById("");

      await expect(userMe).rejects.toThrowError();
    });
  });

  describe("findUserByUsername", () => {
    it("should return a user object when the user exists", async () => {
      const { username } = normalUser1.data;

      const userByUsername = await userRepository.findUserByUsername(username);

      expect(userByUsername.username).toBe(normalUser1.data.username);
    });

    it("should return null if the user does not exist", async () => {
      const username = "testUsername";

      const userMe = await userRepository.findUserByUsername(username);

      expect(userMe).toBeNull();
    });
  });

  describe("findUserByEmail", () => {
    it("should return a user object when the user exists", async () => {
      const { email } = normalUser1.data;

      const userByEmail = await userRepository.findUserByEmail(email);

      expect(userByEmail.email).toBe(normalUser1.data.email);
    });

    it("should return null if the user does not exist", async () => {
      const email = "example@example.com";

      const userByEmail = await userRepository.findUserByUsername(email);

      expect(userByEmail).toBeNull();
    });
  });

  describe("findUserPkById", () => {
    it("should return the user's primary key", async () => {
      const { id } = normalUser1.data;

      const userPk = await userRepository.findUserPkById(id);

      expect(userPk).not.toBeNaN();
    });

    it("should return null if the user does not exist", async () => {
      const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

      const userPk = await userRepository.findUserPkById(id);

      expect(userPk).toBeNull();
    });
  });

  describe("findUsersPkById", () => {
    it("should return an array of user primary keys for valid user IDs", async () => {
      const userIds = [normalUser1.data.id, demoUser1.data.id];

      const userPks = await userRepository.findUsersPkById(userIds);

      expect(userPks).toHaveLength(2);
      expect(userPks.every((pk) => typeof pk === "number")).toBeTruthy();
    });

    it("should return an empty array when given empty input", async () => {
      const userPks = await userRepository.findUsersPkById([]);

      expect(userPks).toEqual([]);
    });
  });

  describe("updateUsernameById", () => {
    it("should return the unmodified user when no username is provided", async () => {
      const { id, username: originalUsername } = normalUser1.data;

      const updatedUser = await userRepository.updateUsernameById(
        id,
        undefined
      );

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("username");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.username).toBe(originalUsername);
    });

    it("should update the username and return the updated user", async () => {
      const { id } = normalUser1.data;
      const username = "john_doe";

      const updatedUser = await userRepository.updateUsernameById(id, username);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("username");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.username).not.toBe(normalUser1.data.username);
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    it("throws a DatabaseError if the provided username is null", async () => {
      const { id } = normalUser1.data;

      const updatedUser = userRepository.updateUsernameById(id, null);

      await expect(updatedUser).rejects.toThrowError();
    });
  });

  describe("updateEmailById", () => {
    it("should update the email and return the updated user", async () => {
      const { id } = normalUser1.data;
      const newEmail = "john.doe@gmail.com";

      const updatedUser = await userRepository.updateEmailById(id, newEmail);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("email");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.email).not.toBe(normalUser1.data.email);
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    it("should update even when email remains the same (updating updatedAt)", async () => {
      const { id } = normalUser1.data;
      const { email } = normalUser1.data;

      const updatedUser = await userRepository.updateEmailById(id, email);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("email");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.email).toMatch(normalUser1.data.email);
    });
  });

  describe("updatePasswordById", () => {
    it("should update the password and return the updated user", async () => {
      const { id } = normalUser1.data;
      const newPassword = "newpassword123";

      const updatedUser = await userRepository.updatePasswordById(
        id,
        newPassword
      );

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("password");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.password).not.toBe(normalUser1.password);
    });
  });

  describe("deleteUserById", () => {
    it("should delete the user and return the deleted user", async () => {
      const user = await userRepository.createUser({
        username: "deleted_user",
      });

      const deletedUser = await userRepository.deleteUserById(user.id);

      expect(deletedUser.id).toBe(user.id);
      await expect(
        userRepository.findUserById(deletedUser.id)
      ).resolves.toBeNull();
    });

    it("should throw DatabaseError for non-existent user IDs", async () => {
      const deletedUser = userRepository.deleteUserById("testid");

      await expect(deletedUser).rejects.toThrowError();
    });
  });
});
