import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../db/client.js";
import app from "../../utils/server.js";
import userFactory from "../../utils/user-factory.js";
import initSetupUsers from "../../utils/setup-users.js";
import baseRequest from "../../utils/base-request.js";
import { idGenerator } from "../../../utils.js";

const request = baseRequest({ request: req(app), url: "/api/v1" });

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
const directChatId = idGenerator();

beforeAll(async () => {
  const groupChatPayload = {
    ownerId: user1Id,
    name: "test_group_chat",
    type: "GroupChat",
  };

  const directChatPayload = {
    chatId: directChatId,
    type: "DirectChat",
    memberIds: [user1Id, user2Id],
  };

  await client.$transaction([
    ...entities.map((entity) => client.user.create({ data: { ...entity } })),
  ]);

  const [groupChatResult] = await Promise.all([
    request.chat.post.chat(user1AccessToken, groupChatPayload),
    request.chat.post.chat(user1AccessToken, directChatPayload),
  ]);

  groupChatId = groupChatResult.body.id;

  return async () => {
    const chatIds = [directChatId, groupChatId].filter(Boolean);

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

describe("Chat deletion", () => {
  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          chatId: directChatId,
          token: user1InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          chatId: directChatId,
          token: user1ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          chatId: directChatId,
          token: user1AccessToken,
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
        const { chatId, token, includeAuth } = data;

        const res = await request.chat.delete.deleteChat(chatId, token, {
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
        scenario: "a non-member tries to delete a group chat",
        data: {
          token: user3AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Must be owner to delete chat",
        },
      },
      {
        scenario: "a member that's not the owner deletes the chat",
        data: {
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Must be owner to delete chat",
        },
      },
      {
        scenario: "a member trying to delete a direct chat",
        data: {
          chatId: directChatId,
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Direct chat cannot be deleted",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ data, expectedError }) => {
        const { chatId, token } = data;
        const res = await request.chat.delete.deleteChat(
          chatId ?? groupChatId,
          token
        );

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
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "user deleting a direct chat they're not a member",
        data: {
          token: user3AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, token } = data;

        const res = await request.chat.delete.deleteChat(
          chatId ?? directChatId,
          token
        );

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
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, token } = data;

        const res = await request.chat.delete.deleteChat(chatId, token);

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    it("returns 204 (NO_CONTENT)", async () => {
      const res = await request.chat.delete.deleteChat(
        groupChatId,
        user1AccessToken
      );

      expect(res.status).toBe(204);

      expect(
        await client.chat.findUnique({ where: { id: groupChatId } })
      ).toBeNull();
    });
  });
});
