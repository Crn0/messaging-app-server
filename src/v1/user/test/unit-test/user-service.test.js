import { describe, it, expect, beforeEach } from "vitest";
import { seedDb } from "../mocks/db/index.js";
import userRepository, {
  dbClear,
} from "../mocks/repository/user-repository.js";
import initUserService from "../../user-service.js";
import userFactory from "../utils/user-factory.js";

let createdUser01;
let createdUser02;

const User = userFactory();

const userService = initUserService({
  userRepository,
  chatService: {
    getUserMessagesById: async () => [],
  },
  passwordManager: {
    hashPassword: async (val) => val,
    verifyPassword: (oldPass, newPass) => oldPass === newPass,
  },
  includeBuilder: {
    normalizeInclude: (val) => val.split(","),
    buildIncludeQuery: (val) => val.map((str) => str.split(".")[0]),
  },
});

describe("User service", () => {
  beforeEach(async () => {
    createdUser01 = await User.create(1);
    createdUser02 = await User.create(1);

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

  describe("createUser", () => {
    it("should create a new user and returns a user object", async () => {
      const username = "vergil";

      const createdUser = await userService.createUser({ username });

      expect(createdUser).toHaveProperty("id");
      expect(createdUser).toHaveProperty("username");
    });

    it("should throw a ConflictError if the username is already taken", async () => {
      const { username, password } = createdUser01.entity;

      const duplicateUser = userService.createUser({
        username,
        password,
      });

      await expect(duplicateUser).rejects.toThrowError(
        expect.objectContaining({
          message: "Validation Error",
          httpCode: 409,
        })
      );
    });
  });

  describe("getUserPkById", () => {
    it("should return the user's primary key", async () => {
      const userPk = await userService.getUserPkById(createdUser01.data.id);

      expect(userPk).toBe(createdUser01.data.pk);
    });

    it("should throw a NotFoundError with 'User not found' message for non-existent IDs", async () => {
      const userPk = userService.getUserPkById("testid01");

      await expect(userPk).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("meById", () => {
    it("should throw a NotFoundError with 'User not found' message for non-existent IDs", async () => {
      const include = "friends.id,chats.id";

      const userById = userService.getUserById("testid", include);

      await expect(userById).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("getUserById", () => {
    it("should return a user object when the user exists", async () => {
      const { id } = createdUser01.data;

      const userById = await userService.getUserById(id);

      expect(userById.id).toBe(id);
    });

    it("should throw a NotFoundError with 'User not found' message for non-existent IDs", async () => {
      const userById = userService.getUserById("testid");

      await expect(userById).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("getUserByUsername", () => {
    it("should return a user object when the user exists", async () => {
      const { username } = createdUser01.entity;

      const userByUsername = await userService.getUserByUsername(username);

      expect(userByUsername.username).toBe(createdUser01.entity.username);
    });

    it("returns null if the user does not exist", async () => {
      const username = "testusername";

      const userByUsername = await userService.getUserByUsername(username);

      expect(userByUsername).toBe(null);
    });
  });

  describe("getUserByEmail", () => {
    it("should return a user object when the user exists", async () => {
      const { email } = createdUser01.entity;

      const userByEmail = await userService.getUserByEmail(email);

      expect(userByEmail.email).toBe(createdUser01.entity.email);
    });

    it("returns null if the user does not exist", async () => {
      const email = "example@gmail.com";

      const userByEmail = await userService.getUserByEmail(email);

      expect(userByEmail).toBeNull();
    });
  });

  describe("getUsersPkById", () => {
    it("should return an array of user primary keys for valid user IDs", async () => {
      const userIds = [createdUser01.data.id, createdUser02.data.id];

      const userPks = await userService.getUsersPkById(userIds);

      expect(userPks).toHaveLength(2);
      expect(userPks.every((pk) => typeof pk === "number")).toBeTruthy();
    });

    it("should return an empty array when given empty input", async () => {
      const userPks = await userService.getUsersPkById([]);

      expect(userPks).toEqual([]);
    });

    it("should throw an error when given non-array input", async () => {
      const userPks = userService.getUsersPkById(null);

      await expect(userPks).rejects.toThrowError(
        /expected "userIds" to be a array received null/
      );
    });
  });

  describe("updateUsernameById", () => {
    it("should update the username and return the updated user", async () => {
      const { id } = createdUser01.entity;
      const username = "john.doe";

      const updatedUser = await userService.updateUsernameById(id, username);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("username");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.username).not.toMatch(createdUser01.entity.username);
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    it("should update even when username remains the same (updating updatedAt)", async () => {
      const { id } = createdUser01.entity;
      const { username } = createdUser01.entity;

      const updatedUser = await userService.updateUsernameById(id, username);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("username");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.username).toMatch(createdUser01.username);
    });

    it("should throw a ValidationError when username is taken by another user", async () => {
      const { id } = createdUser01.entity;
      const { username } = createdUser02.entity;

      const updatedUser = userService.updateUsernameById(id, username);

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "Validation Error",
          httpCode: 409,
        })
      );
    });

    it("should throw NotFoundError for non-existent user IDs", async () => {
      const updatedUser = userService.updateUsernameById("testid", "jane_doe");

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("updateEmailById", () => {
    it("should update the email and return the updated user", async () => {
      const { id } = createdUser01.entity;
      const newEmail = "john.doe@gmail.com";

      const updatedUser = await userService.updateEmailById(id, newEmail);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("email");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.email).not.toMatch(createdUser01.entity.email);
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    it("should update even when email remains the same (updating updatedAt)", async () => {
      const { id } = createdUser01.entity;
      const { email } = createdUser01.entity;

      const updatedUser = await userService.updateEmailById(id, email);

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("email");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.email).toMatch(createdUser01.entity.email);
    });

    it("should throw ConflictError when email is taken by another user", async () => {
      const { id } = createdUser01.entity;
      const { email } = createdUser02.entity;

      const updatedUser = userService.updateUsernameById(id, email);

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "Validation Error",
          httpCode: 409,
        })
      );
    });

    it("should throw NotFoundError for non-existent user IDs", async () => {
      const updatedUser = userService.updateEmailById("testid", "jane_doe");

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("updatePasswordById", () => {
    it("should update the password and return the updated user", async () => {
      const { id } = createdUser01.entity;
      const oldPassword = createdUser01.data.password;
      const newPassword = "newpassword123";

      const updatedUser = await userService.updatePasswordById(
        id,
        oldPassword,
        newPassword
      );

      expect(updatedUser).toHaveProperty("id");
      expect(updatedUser).toHaveProperty("password");
      expect(updatedUser).toHaveProperty("updatedAt");
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.password).not.toMatch(createdUser01.data.password);
    });

    it("throws a error if the provided old password is incorrect", async () => {
      const { id } = createdUser01.entity;
      const oldPassword = "doesnotmatch";
      const newPassword = "newpassword123";

      const updatedUser = userService.updatePasswordById(
        id,
        oldPassword,
        newPassword
      );

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "Validation Error",
          httpCode: 422,
        })
      );
    });

    it("should throw NotFoundError for non-existent user IDs", async () => {
      const updatedUser = userService.updatePasswordById("testid", "jane_doe");

      await expect(updatedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("deleteUserById", () => {
    it("should delete the user and return the deleted user", async () => {
      const { id } = createdUser01.entity;

      const deletedUser = await userService.deleteUserById(id);

      expect(deletedUser.id).toMatch(createdUser01.data.id);
      await expect(
        userService.getUserById(deletedUser.id)
      ).rejects.toThrowError(/User not found/);
    });

    it("should throw NotFoundError for non-existent user IDs", async () => {
      const deletedUser = userService.deleteUserById("testid");

      await expect(deletedUser).rejects.toThrowError(
        expect.objectContaining({
          message: "User not found",
          httpCode: 404,
        })
      );
    });
  });

  describe("deleteUsers", () => {
    it("should delete the users returns a object with a propery count", async () => {
      const deletedUsers = await userService.deleteUsers();

      expect(deletedUsers).toHaveProperty("count");
    });
  });
});
