import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";

const userReq = baseRequest({ request: request.agent(app), url: "/api/v1" });
const demoUserReq = baseRequest({
  request: request.agent(app),
  url: "/api/v1",
});

const User = userFactory();

const user = await User.create(1);
const demoUser = await User.create(0);

const { accessToken, invalidToken, expiredToken } = user.data;

const { accessToken: demoUserAccessToken } = demoUser.data;

beforeAll(async () => {
  await Promise.all([
    client.user.create({
      data: {
        ...user.entity,
      },
    }),
    client.user.create({
      data: {
        ...demoUser.entity,
      },
    }),
  ]);

  return async () => {
    await client.user.deleteMany({
      where: { id: { in: [user.data.id, demoUser.data.id] } },
    });
  };
});

describe("User authentication", () => {
  const form = {
    username: user.data.username,
    password: user.data.password,
  };

  const invalidForm = { username: "john@@@", password: "password1234" };

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "invalid username",
        data: {
          username: invalidForm.username,
          password: form.password,
        },
        expectedError: { path: ["username"], code: "custom" },
      },
      {
        scenario: "weak password",
        data: {
          username: form.username,
          password: invalidForm.password,
        },
        expectedError: { path: ["password"], code: "custom" },
      },
      {
        scenario: "invalid credentials",
        data: {
          username: "test_username",
          password: form.password,
        },
        expectedError: { message: "Invalid user credentials", code: 422 },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ scenario, data, expectedError }) => {
        const res = await userReq.auth.post.logIn(data);

        expect(res.status).toBe(422);

        if (scenario === "invalid credentials") {
          return expect(res.body).toMatchObject(expectedError);
        }

        return expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) with tokens", async () => {
      const res = await userReq.auth.post.logIn(form);

      const cookies = res.headers["set-cookie"];

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(cookies).not.toHaveLength(0);
    });

    it("returns 205 (NO_CONTENT_REFRESH) and clear the user's refreshToken", async () => {
      const res = await userReq.auth.post.logOut();

      const cookies = res.headers["set-cookie"];

      expect(cookies[0]).toMatch(
        "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
      );
    });
  });
});

describe("User detail", () => {
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
          token: accessToken,
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

        const res = await userReq.user.get.me(token, null, { includeAuth });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success case", () => {
    it("returns 200 (OK) with user data for valid token", async () => {
      const res = await userReq.user.get.me(accessToken, null);

      expect(res.status).toBe(200);
      expect(res.body).haveOwnProperty("id");
      expect(res.body).haveOwnProperty("username");
      expect(res.body).not.haveOwnProperty("password");
    });
  });
});

describe("User creation", () => {
  const form = {
    username: "test_username",
    displayName: "test_username",
    password: "Password1234",
    confirmPassword: "Password1234",
  };

  const invalidForm = {
    username: "@test_username@",
    password: "password1234",
    confirmPassword: "Password1234",
  };

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "invalid username",
        data: {
          username: invalidForm.username,
          password: form.password,
          confirmPassword: form.password,
        },
        expectedError: { path: ["username"], code: "custom" },
      },
      {
        scenario: "weak password",
        data: {
          username: form.username,
          password: invalidForm.password,
          confirmPassword: invalidForm.password,
        },
        expectedError: { path: ["password"], code: "custom" },
      },
      {
        scenario: "password does not match",
        data: {
          username: form.username,
          password: form.password,
          confirmPassword: invalidForm.password,
        },
        expectedError: { path: ["confirmPassword"], code: "custom" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const res = await userReq.auth.post.register(data);

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 204 (NO_CONTENT) when the user registration is successful", async () => {
      const res = await userReq.auth.post.register(form);

      expect(res.status).toBe(204);

      const createdUser = await client.user.findUnique({
        where: { username: form.username },
      });

      expect(createdUser).toBeDefined();

      await client.user.delete({ where: { id: createdUser.id } });
    });

    it("register the user when a optional field is not provided", async () => {
      const clone = structuredClone(form);

      delete clone.displayName;

      const res = await userReq.auth.post.register(clone);

      expect(res.status).toBe(204);

      const createdUser = await client.user.findUnique({
        where: { username: form.username },
      });

      expect(createdUser).toBeDefined();

      await client.user.delete({ where: { id: createdUser.id } });
    });
  });
});

describe("User deletion", () => {
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
          token: accessToken,
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

        const res = await userReq.user.delete.account(token, {
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
        scenario: "when demo user is updating its' password",
        data: {
          authReq: demoUserReq,
          token: demoUserAccessToken,

          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Demo user cannot delete their account",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { authReq, token, includeAuth } = data;

        const res = await authReq.user.delete.account(token, {
          includeAuth,
        });

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe.skip("Success Case", () => {
    it("501 (NOT_IMPLEMENTED)", async () => {
      const res = await userReq.user.delete.account(user.data.id, accessToken);

      expect(res.status).toBe(501);
    });
  });
});
