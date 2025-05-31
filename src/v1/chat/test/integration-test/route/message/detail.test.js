import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../../db/client.js";
import app from "../../../utils/server.js";
import {
  baseRequest,
  userFactory,
  createCursorManager,
  setupTestUsers as initSetupUsers,
} from "../../../utils/index.js";
import { idGenerator } from "../../../../utils.js";

const request = baseRequest({ request: req(app), url: "/api/v1" });

const User = userFactory();
const setupTestUsers = initSetupUsers(User);

const {
  users,
  entities,
  ids: { user1Id, user2Id },
  accessTokens: {
    user1AccessToken,
    user2AccessToken,
    user3AccessToken: nonMemberAccessToken,
  },
  expiredTokens: { user2ExpiredToken },
  invalidTokens: { user2InvalidToken },
} = await setupTestUsers(3);

let groupChatId;
let directChatId;

beforeAll(async () => {
  const groupChatPayload = {
    ownerId: user1Id,
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

  await request.member.post.joinMember(
    groupChatResult.body.id,
    user2AccessToken
  );

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

describe("Message detail", () => {
  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          chatId: idGenerator(),
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          chatId: idGenerator(),
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          chatId: idGenerator(),
          token: user2AccessToken,
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

        const res = await request.message.get.messageList(chatId, token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Bad Request Errors", () => {
    const scenarios = [
      {
        scenario: "cursor ID does not exist",
        data: {
          token: user1AccessToken,
          before: idGenerator(),
          includeAuth: true,
        },
        expectedError: {
          code: 400,
          message: "Invalid cursor",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 400 when $scenario",
      async ({ data, expectedError }) => {
        const { before, token } = data;

        const res = await request.message.get.messageList(groupChatId, token, {
          before,
        });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    const scenarios = [
      {
        scenario: "a non-member requesting chat messages",
        data: {
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to view chat messages",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ data, expectedError }) => {
        const { token } = data;

        const res = await request.message.get.messageList(groupChatId, token);

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
        scenario: "user requesting a private chat messages",
        data: {
          token: nonMemberAccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { token } = data;
        const chatId = data?.chatId ?? directChatId;

        const res = await request.message.get.messageList(chatId, token);

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
          before: idGenerator(),
          token: user1AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "before cursoir ID invalid format",
        data: {
          chatId: idGenerator(),
          before: "invalid_id_format",
          token: user1AccessToken,
        },
        expectedError: { path: ["before"], code: "invalid_string" },
      },
      {
        scenario: "after cursoir ID invalid format",
        data: {
          chatId: idGenerator(),
          after: "invalid_id_format",
          token: user1AccessToken,
        },
        expectedError: { path: ["after"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { before, after, token } = data;

        const chatId = data?.chatId ?? groupChatId;

        const res = await request.message.get.messageList(chatId, token, {
          before,
          after,
        });

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    const cursor = createCursorManager();

    beforeAll(async () => {
      await Promise.all(
        Array.from({ length: 10 }).map(async (_, i) =>
          request.message.post.createMessage(
            groupChatId,
            {
              name: `test_message${i}`,
            },
            user1AccessToken
          )
        )
      );
    });

    const scenarios = [
      {
        scenario: "with messages, returns nextHref and null prevHref",

        data: {
          direction: "none",
          token: user1AccessToken,
        },
      },
      {
        scenario: "on forward pagination with a valid 'after' cursor",

        data: {
          direction: "forward",
          token: user1AccessToken,
        },
      },
      {
        scenario: "on backward pagination with a valid 'before' cursor",

        data: {
          direction: "backward",
          token: user1AccessToken,
        },
      },
    ];

    // Note: MESSAGES_PAGE_SIZE is set to 1 in test environment; 25 in production
    it.each(scenarios)("returns 200 (OK) $scenario", async ({ data }) => {
      const { direction, token } = data;
      const chatId = groupChatId;
      const ops = { ...cursor.getCursor(direction) };

      const res = await request.message.get.messageList(chatId, token, {
        ...ops,
      });

      const { messages, pagination } = res.body;

      const expectedMessages = expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          content: null,
          createdAt: expect.any(String),
          updatedAt: null,
          user: expect.any(Object),
          deletedAt: null,
          replies: expect.any(Array),
          replyTo: null,
          chatId: expect.any(String),
          attachments: expect.any(Array),
        }),
      ]);

      const expectedPagination = {
        nextHref: expect.any(String),
        prevHref: direction === "forward" ? expect.any(String) : null,
      };

      expect(res.status).toBe(200);
      expect(messages).toEqual(expectedMessages);
      expect(pagination).toMatchObject(expectedPagination);

      cursor.setCursor(direction, pagination);
    });
  });
});
