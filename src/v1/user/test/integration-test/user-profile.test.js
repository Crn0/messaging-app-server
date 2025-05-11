import "dotenv/config";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import Storage from "../../../storage/index.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";
import attachment from "../data/attachment.js";

const storage = Storage();

const userReq = baseRequest({ request: request.agent(app), url: "/api/v1" });
const User = userFactory();

const user = await User.create(1);
const unAuthUser = await User.create(1);

const { id, accessToken, invalidToken, expiredToken } = user.data;
const { accessToken: unAuthorizedAccessToken } = unAuthUser.data;

beforeAll(async () => {
  await client.user.create({
    data: {
      ...user.entity,
    },
  });

  return async () => {
    const attachmentPath = `${process.env.CLOUDINARY_ROOT_NAME}/avatars/${id}`;

    await Promise.all([
      client.user.delete({ where: { id } }),
      storage.destroyFolder(attachmentPath),
    ]);
  };
});

describe("Update displayName", () => {
  const form = { displayName: "odin.son" };

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
          token: accessToken,
          payload: { ...form },
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.displayName(
          userId,
          token,
          payload,
          { includeAuth }
        );

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
          userId: id,
          token: unAuthorizedAccessToken,
          payload: form,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.displayName(
          userId,
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

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "maxium character reached",
        data: {
          userId: id,
          token: accessToken,
          payload: {
            displayName: Array.from({ length: 40 }, () => "str").join(""),
          },
          includeAuth: true,
        },
        expectedError: { path: ["displayName"], code: "too_big" },
      },
      {
        scenario: "displayName is undefined",
        data: {
          userId: id,
          token: accessToken,
          payload: {},
          includeAuth: true,
        },
        expectedError: { path: ["displayName"], code: "invalid_type" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.displayName(
          userId,
          token,
          payload,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the user id with the updated display name", async () => {
      const res = await userReq.profile.patch.displayName(
        id,
        accessToken,
        form
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        displayName: form.displayName,
      });

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { displayName: true } } },
      });

      expect(updatedUser.profile.displayName).toBe(form.displayName);
    });
  });
});

describe("Update aboutMe", () => {
  const form = { aboutMe: `hi i am ${user.data.username} :)` };

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
          token: accessToken,
          payload: { ...form },
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.aboutMe(
          userId,
          token,
          payload,
          { includeAuth }
        );

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
          userId: id,
          token: unAuthorizedAccessToken,
          payload: form,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.aboutMe(
          userId,
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

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "maxium character reached",
        data: {
          userId: id,
          token: accessToken,
          payload: {
            aboutMe: Array.from({ length: 200 }, () => "str").join(""),
          },
          includeAuth: true,
        },
        expectedError: { path: ["aboutMe"], code: "too_big" },
      },
      {
        scenario: "aboutMe is undefined",
        data: {
          userId: id,
          token: accessToken,
          payload: {},
          includeAuth: true,
        },
        expectedError: { path: ["aboutMe"], code: "invalid_type" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.aboutMe(
          userId,
          token,
          payload,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("returns 200 (OK) and the user id with the updated about me", async () => {
      const res = await userReq.profile.patch.aboutMe(id, accessToken, form);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        aboutMe: form.aboutMe,
      });

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { aboutMe: true } } },
      });

      expect(updatedUser.profile.aboutMe).toBe(form.aboutMe);
    });
  });
});

describe("Update avatar", () => {
  const file = attachment.avatar;
  const invalidFile = attachment.catGif;

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          payload: file,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          payload: file,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
          token: accessToken,
          payload: file,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.avatar(userId, token, payload, {
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
          userId: id,
          token: unAuthorizedAccessToken,
          payload: file,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.avatar(userId, token, payload, {
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
        scenario: "not accepted mimetype",
        data: {
          userId: id,
          token: accessToken,
          payload: invalidFile,
          includeAuth: true,
        },
        expectedError: { path: ["avatar", "mimetype"], code: "custom" },
      },
      {
        scenario: "undefined payload",
        data: {
          userId: id,
          token: accessToken,
          includeAuth: true,
        },
        expectedError: { path: ["avatar"], code: "invalid_type" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.avatar(userId, token, payload, {
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
    it("it returns 204 (NO_CONTENT)", async () => {
      const res = await userReq.profile.patch.avatar(id, accessToken, file);

      expect(res.status).toBe(204);

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { avatar: true } } },
      });

      expect(updatedUser.profile.avatar).not.toBeNull();
    });
  });
});

describe("Update backgroundAvatar", () => {
  const file = attachment.backgroundAvatar;
  const invalidFile = attachment.catGif;

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          payload: file,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          payload: file,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
          token: accessToken,
          payload: file,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.backgroundAvatar(
          userId,
          token,
          payload,
          {
            includeAuth,
          }
        );

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
          userId: id,
          token: unAuthorizedAccessToken,
          payload: file,
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
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.backgroundAvatar(
          userId,
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

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "not accepted mimetype",
        data: {
          userId: id,
          token: accessToken,
          payload: invalidFile,
          includeAuth: true,
        },
        expectedError: {
          path: ["backgroundAvatar", "mimetype"],
          code: "custom",
        },
      },
      {
        scenario: "undefined payload",
        data: {
          userId: id,
          token: accessToken,
          includeAuth: true,
        },
        expectedError: { path: ["backgroundAvatar"], code: "invalid_type" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { userId, token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.backgroundAvatar(
          userId,
          token,
          payload,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success Case", () => {
    it("it returns 204 (NO_CONTENT)", async () => {
      const res = await userReq.profile.patch.backgroundAvatar(
        id,
        accessToken,
        file
      );

      expect(res.status).toBe(204);

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { backgroundAvatar: true } } },
      });

      expect(updatedUser.profile.backgroundAvatar).not.toBeNull();
    });
  });
});

describe("Delete avatar", () => {
  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
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
        const { userId, token, includeAuth } = data;

        const res = await userReq.profile.delete.avatar(userId, token, {
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
          userId: id,
          token: unAuthorizedAccessToken,
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
        const { userId, token, includeAuth } = data;

        const res = await userReq.profile.delete.avatar(userId, token, {
          includeAuth,
        });

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("it returns 204 (NO_CONTENT)", async () => {
      const res = await userReq.profile.delete.avatar(id, accessToken);

      expect(res.status).toBe(204);

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { avatar: true } } },
      });

      expect(updatedUser.profile.avatar).toBeNull();
    });
  });
});

describe("Delete backgroundAvatar", () => {
  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          userId: id,
          token: invalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          userId: id,
          token: expiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          userId: id,
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
        const { userId, token, includeAuth } = data;

        const res = await userReq.profile.delete.backgroundAvatar(
          userId,
          token,
          {
            includeAuth,
          }
        );

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
          userId: id,
          token: unAuthorizedAccessToken,
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
        const { userId, token, includeAuth } = data;

        const res = await userReq.profile.delete.backgroundAvatar(
          userId,
          token,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Success Case", () => {
    it("it returns 204 (NO_CONTENT)", async () => {
      const res = await userReq.profile.delete.backgroundAvatar(
        id,
        accessToken
      );

      expect(res.status).toBe(204);

      const updatedUser = await client.user.findUnique({
        where: { id },
        select: { profile: { select: { backgroundAvatar: true } } },
      });

      expect(updatedUser.profile.backgroundAvatar).toBeNull();
    });
  });
});
