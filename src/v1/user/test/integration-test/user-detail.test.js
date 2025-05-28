import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";

const userReq = baseRequest({ request: request.agent(app), url: "/api/v1" });

const User = userFactory();

const user = await User.create(1);
const demoUser = await User.create(0);
const unAuthUser = await User.create(1);

const {
  id,
  accessToken,
  invalidToken,
  expiredToken,
  username: oldUsername,
  password: oldPassword,
} = user.data;

const { id: demoUserId, accessToken: demoUserAccessToken } = demoUser.data;

const { accessToken: unAuthorizedAccessToken } = unAuthUser.data;

const logInForm = {
  username: oldUsername,
  password: oldPassword,
};

beforeAll(async () => {
  await client.$transaction([
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
    await Promise.all([
      client.user.deleteMany({
        where: { id: { in: [id, demoUserId] } },
      }),
    ]);
  };
});

describe("Update user's username", () => {
  const form = {
    username: "valid.username04",
  };

  const invalidForm = {
    username: "@Invalid.username04@",
  };

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          token: invalidToken,
          payload: form,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: expiredToken,
          payload: form,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          token: accessToken,
          payload: form,
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

        const res = await userReq.user.patch.username(token, payload, {
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
          token: demoUserAccessToken,
          payload: { username: "demo_user" },
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Demo user cannot update their username",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.user.patch.username(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "weak username",
        data: {
          token: accessToken,
          payload: {
            username: invalidForm.username,
          },
          includeAuth: true,
        },
        expectedError: { path: ["username"], code: "custom" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.user.patch.username(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) with user's id and updated username", async () => {
      const res = await userReq.user.patch.username(accessToken, form);

      logInForm.username = res.body.username;

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        username: form.username,
      });
    });
  });
});

describe("Update user's password", () => {
  const form = {
    oldPassword,
    currentPassword: "Password1234",
    confirmPassword: "Password1234",
  };

  const invalidForm = {
    oldPassword: "oldPassword",
    currentPassword: "weakpassword",
    confirmPassword: "passwordnotmatch",
  };

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          token: invalidToken,
          payload: form,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: expiredToken,
          payload: form,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          token: accessToken,
          payload: form,
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

        const res = await userReq.user.patch.password(token, payload, {
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
          token: demoUserAccessToken,
          payload: {
            ...form,
          },
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Demo user cannot update their password",
        },
      },
    ])(
      "fails with 403 (FORBIDDEN) when $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.user.patch.password(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "weak password",
        data: {
          token: accessToken,
          payload: {
            oldPassword: form.oldPassword,
            currentPassword: invalidForm.currentPassword,
            confirmPassword: invalidForm.currentPassword,
          },
          includeAuth: true,
        },
        expectedError: { path: ["currentPassword"], code: "custom" },
      },
      {
        scenario: "password does not match",
        data: {
          token: accessToken,
          payload: {
            oldPassword: form.oldPassword,
            currentPassword: form.currentPassword,
            confirmPassword: invalidForm.currentPassword,
          },
          includeAuth: true,
        },
        expectedError: { path: ["confirmPassword"], code: "custom" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.user.patch.password(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 205 (NO_CONTENT_REFRESH) and logout the user", async () => {
      await userReq.auth.post.logIn(logInForm);

      const res = await userReq.user.patch.password(accessToken, form);

      const cookies = res.headers["set-cookie"];

      expect(res.status).toBe(205);
      expect(cookies[0]).toMatch(
        "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
      );
    });
  });
});
