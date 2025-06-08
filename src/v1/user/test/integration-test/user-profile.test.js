import "dotenv/config";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import Storage from "../../../storage/index.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";
import attachment from "../data/attachment.js";
import { env } from "../../../../constants/index.js";

const { TEST_UPLOAD } = env;

const storage = Storage();

const userReq = baseRequest({ request: request.agent(app), url: "/api/v1" });
const User = userFactory();

const user = await User.create(1);

const { id, accessToken, invalidToken, expiredToken } = user.data;

beforeAll(async () => {
  await client.user.create({
    data: {
      ...user.entity,
    },
  });

  return async () => {
    const attachmentPath = `${process.env.CLOUDINARY_ROOT_NAME}/avatars/${id}`;

    if (TEST_UPLOAD) {
      await storage
        .destroyFolder(attachmentPath)
        .then(console.log)
        .catch(console.log);
    }

    await client.user.delete({ where: { id } });
  };
});

describe("Profile update", () => {
  const form = {
    displayName: "_crno_",
    aboutMe: "hello world!",
    avatar: attachment.avatar,
    backgroundAvatar: attachment.backgroundAvatar,
  };

  const invalidForm = {
    displayName: Array.from({ length: 40 }, () => "str").join(""),
    aboutMe: Array.from({ length: 200 }, () => "str").join(""),
    avatar: attachment.catGif,
    backgroundAvatar: attachment.catGif,
  };

  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          token: invalidToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: expiredToken,
          payload: { ...form },
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          token: accessToken,
          payload: { ...form },
          includeAuth: false,
        },
        expectedError: {
          code: 401,
          message: "Required 'Authorization' header is missing",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.profile(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Validation Errors", () => {
    const scenarios = [
      {
        scenario: "display name maxium character reached",
        data: {
          token: accessToken,
          payload: {
            displayName: invalidForm.displayName,
            aboutMe: form.aboutMe,
          },
          includeAuth: true,
        },
        expectedError: { path: ["displayName"], code: "too_big" },
      },
      {
        scenario: "about me maxium character reached",
        data: {
          token: accessToken,
          payload: {
            displayName: form.displayName,
            aboutMe: invalidForm.aboutMe,
          },
          includeAuth: true,
        },
        expectedError: { path: ["aboutMe"], code: "too_big" },
      },
      {
        scenario: "avatar not accepted mimetype",
        data: {
          token: accessToken,
          payload: {
            displayName: form.displayName,
            aboutMe: form.aboutMe,
            avatar: invalidForm.avatar,
          },
          includeAuth: true,
        },
        expectedError: { path: ["avatar", "mimetype"], code: "custom" },
      },
      {
        scenario: "background avatar not accepted mimetype",
        data: {
          token: accessToken,
          payload: {
            displayName: form.displayName,
            aboutMe: form.aboutMe,
            backgroundAvatar: invalidForm.backgroundAvatar,
          },
          includeAuth: true,
        },
        expectedError: {
          path: ["backgroundAvatar", "mimetype"],
          code: "custom",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await userReq.profile.patch.profile(token, payload, {
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
    const scenarios = [
      {
        scenario: "updated the display name and about me",
        isUpload: false,
        skip: false,
        token: accessToken,
        payload: {
          displayName: form.displayName,
          aboutMe: form.aboutMe,
        },
      },
      {
        scenario: "updated the avatar and background avatar",
        isUpload: true,
        skip: TEST_UPLOAD !== true,
        token: accessToken,
        payload: {
          displayName: form.displayName,
          aboutMe: form.aboutMe,
          avatar: form.avatar,
          backgroundAvatar: form.backgroundAvatar,
        },
      },
    ];

    it.each(scenarios)(
      "returns 200 (OK) and the user ID when the user $scenario",
      async ({ isUpload, skip, token, payload }) => {
        if (skip) return;

        const res = await userReq.profile.patch.profile(token, payload);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id });

        if (isUpload) {
          const updatedProfile = await client.profile.findFirst({
            where: { user: { id } },
            select: {
              avatar: true,
              backgroundAvatar: true,
              updatedAt: true,
            },
          });

          expect(updatedProfile.avatar).not.toBeNull();
          expect(updatedProfile.backgroundAvatar).not.toBeNull();
          expect(updatedProfile.updatedAt).not.toBeNull();

          return;
        }

        const updatedProfile = await client.profile.findFirst({
          where: { user: { id } },
          select: {
            displayName: true,
            aboutMe: true,
            updatedAt: true,
          },
        });

        expect(updatedProfile.displayName).toMatch(form.displayName);
        expect(updatedProfile.aboutMe).toMatch(form.aboutMe);
        expect(updatedProfile.updatedAt).not.toBeNull();
      }
    );
  });
});
