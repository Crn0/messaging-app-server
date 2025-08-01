import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../../db/client.js";
import app from "../../../utils/server.js";
import Storage from "../../../../../storage/index.js";
import userFactory from "../../../utils/user-factory.js";
import initSetupUsers from "../../../utils/setup-users.js";
import baseRequest from "../../../utils/base-request.js";
import attachment from "../../../data/file-upload.js";
import { env } from "../../../../../../constants/index.js";
import { idGenerator } from "../../../../utils.js";

const { TEST_UPLOAD } = env;

const request = baseRequest({ request: req(app), url: "/api/v1" });

const storage = Storage();
const User = userFactory();
const setupTestUsers = initSetupUsers(User);

const {
  users,
  entities,
  ids: { user1Id, user2Id },
  accessTokens: { user1AccessToken, user2AccessToken, user3AccessToken },
  invalidTokens: { user1InvalidToken },
  expiredTokens: { user1ExpiredToken },
} = await setupTestUsers(3);

let groupChatId;
let directChatId;

beforeAll(async () => {
  const groupChatPayload = {
    name: "test_group_chat",
    type: "GroupChat",
  };

  const directChatPayload = {
    type: "DirectChat",
    memberIds: [user1Id, user2Id],
  };

  await client.$transaction([
    ...entities.map((entity) => client.user.create({ data: { ...entity } })),
  ]);

  const [groupChatResult, directChatResult] = await Promise.all([
    request.chat.post.chat(user1AccessToken, groupChatPayload),
    request.chat.post.chat(user1AccessToken, directChatPayload),
  ]);

  groupChatId = groupChatResult.body.id;
  directChatId = directChatResult.body.id;

  return async () => {
    const chatIds = [directChatId, groupChatId].filter(Boolean);

    const avatarPath = `${process.env.CLOUDINARY_ROOT_NAME}/avatars/${groupChatId}`;

    if (TEST_UPLOAD) {
      await Promise.allSettled([
        storage.destroyFolder(avatarPath),
        // storage.destroyFolder(messageAttachmentPath),
      ])
        .then(console.log)
        .catch(console.error);
    }

    await client.$transaction([
      client.chat.deleteMany({
        where: { id: { in: chatIds } },
      }),
      client.user.deleteMany({
        where: {
          id: {
            in: users.map(({ id }) => id),
          },
        },
      }),
    ]);
  };
});

describe("Chat update", () => {
  const form = { avatar: attachment.avatar, type: "GroupChat" };

  beforeAll(async () => {
    const member = await client.userOnChat.create({
      data: {
        chat: { connect: { id: groupChatId } },
        user: { connect: { id: user2Id } },
      },
      select: { id: true },
    });

    return async () => client.userOnChat.delete({ where: { id: member.id } });
  });

  describe("Update name", () => {
    describe("Authentication Errors", () => {
      const scenarios = [
        {
          scenario: "invalid token",
          data: {
            token: user1InvalidToken,
            includeAuth: true,
            payload: { name: "updated_group_chat_name" },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            token: user1ExpiredToken,
            includeAuth: true,
            payload: { name: "updated_group_chat_name" },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            token: user1AccessToken,
            includeAuth: false,
            payload: { name: "updated_group_chat_name" },
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
          const { payload, token, includeAuth } = data;

          const chatId = directChatId;

          const res = await request.chat.patch.name(chatId, payload, token, {
            includeAuth,
          });

          expect(res.status).toBe(401);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      const scenarios = [
        {
          scenario: "a non-member tries to update a group chat name",
          data: {
            token: user3AccessToken,
            includeAuth: true,
            payload: { name: "updated_group_chat_name" },
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to modify profile",
          },
        },
        {
          scenario: "a member without admin rights tries to rename",
          data: {
            token: user2AccessToken,
            includeAuth: true,
            payload: { name: "unauthorized_rename" },
          },
          expectedError: {
            code: 403,
            message: "Missing permission: manage_chat or admin",
          },
        },
        {
          scenario: "a member trying to update direct chat name",
          data: {
            type: "DirectChat",
            token: user2AccessToken,
            includeAuth: true,
            payload: { name: "unauthorized_rename" },
          },
          expectedError: {
            code: 403,
            message: "Direct chat cannot be modified",
          },
        },
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { type, payload, token } = data;

          const chatId = type === "DirectChat" ? directChatId : groupChatId;

          const res = await request.chat.patch.name(chatId, payload, token);
          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not Found Errors", () => {
      const scenarios = [
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
            payload: { name: "updated_group_chat_name" },
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;
          const res = await request.chat.patch.name(chatId, payload, token);

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Validation Errors", () => {
      const scenarios = [
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
            payload: { name: "updated_group_chat_name" },
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "name is over 100 characters",
          data: {
            token: user1AccessToken,
            payload: {
              name: Array.from({ length: 200 }, () => "foo").join(""),
            },
          },
          expectedError: { path: ["name"], code: "too_big" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;
          const res = await request.chat.patch.name(
            chatId ?? groupChatId,
            payload,
            token
          );
          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) with updated chat", async () => {
        const payload = { name: "updated_group_chat_name" };
        const res = await request.chat.patch.name(
          groupChatId,
          payload,
          user1AccessToken
        );

        expect(res.status).toBe(200);

        const chat = await client.chat.findUnique({
          where: { id: res.body.id },
        });

        expect(chat.name).toBe(payload.name);
        expect(chat.type).toBe("GroupChat");
        expect(new Date(chat.updatedAt)).toBeInstanceOf(Date);
      });
    });
  });

  describe.skipIf(TEST_UPLOAD === false)("Update avatar", () => {
    describe.skip("Authentication Errors", () => {
      const scenarios = [
        {
          scenario: "invalid token",
          data: {
            token: user1InvalidToken,
            includeAuth: true,
            payload: form,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            token: user1ExpiredToken,
            includeAuth: true,
            payload: form,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            token: user1AccessToken,
            includeAuth: false,
            payload: form,
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
          const { payload, token, includeAuth } = data;
          const res = await request.chat.patch.avatar(
            groupChatId,
            payload,
            token,
            { includeAuth }
          );
          expect(res.status).toBe(401);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      const getId = (type) => {
        if (type === "DirectChat") return directChatId;

        return groupChatId;
      };

      const scenarios = [
        {
          scenario: "a non-member tries to update a group chat avatar",
          data: {
            type: "GroupChat",
            token: user3AccessToken,
            includeAuth: true,
            payload: form,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to modify profile",
          },
        },
        {
          scenario: "a member without admin rights tries to update chat avatar",
          data: {
            type: "GroupChat",
            token: user2AccessToken,
            includeAuth: true,
            payload: form,
          },
          expectedError: {
            code: 403,
            message: "Missing permission: manage_chat or admin",
          },
        },
        {
          scenario: "a member trying to update direct chat avatar",
          data: {
            type: "DirectChat",
            token: user2AccessToken,
            includeAuth: true,
            payload: { ...form },
          },
          expectedError: {
            code: 403,
            message: "Direct chat cannot be modified",
          },
        },
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { type, payload, token } = data;

          const chatId = getId(type);

          const res = await request.chat.patch.avatar(chatId, payload, token);

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe.skip("Not Found Errors", () => {
      const scenarios = [
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
            payload: { ...form, type: "DirectChat" },
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;
          const res = await request.chat.patch.avatar(chatId, payload, token);
          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe.skip("Validation Errors", () => {
      const scenarios = [
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
            payload: { ...form, type: "DirectChat" },
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "avatar invalid mimetype",
          data: {
            token: user1AccessToken,
            payload: { ...form, avatar: attachment.catGif },
          },
          expectedError: { path: ["avatar", "mimetype"], code: "custom" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;
          const res = await request.chat.patch.avatar(
            chatId ?? groupChatId,
            payload,
            token
          );
          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe.skip("Success case", () => {
      it("returns 200 (OK) with the updated chat", async () => {
        const res = await request.chat.patch.avatar(
          groupChatId,
          form,
          user1AccessToken
        );

        expect(res.status).toBe(200);

        const chat = await client.chat.findUnique({
          where: { id: res.body.id },
          include: {
            avatar: {
              include: {
                images: true,
              },
            },
          },
        });

        expect(chat.avatar).not.toBeNull();
        expect(chat.avatar.images).toBeInstanceOf(Array);
      });
    });
  });
});
