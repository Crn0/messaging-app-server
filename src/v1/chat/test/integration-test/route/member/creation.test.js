import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../../db/client.js";
import app from "../../../utils/server.js";
import userFactory from "../../../utils/user-factory.js";
import initSetupUsers from "../../../utils/setup-users.js";
import baseRequest from "../../../utils/base-request.js";
import { idGenerator } from "../../../../utils.js";

const request = baseRequest({ request: req(app), url: "/api/v1" });

const User = userFactory();
const setupTestUsers = initSetupUsers(User);

const {
  users,
  entities,
  ids: { user1Id, user2Id },
  accessTokens: { user1AccessToken, user2AccessToken, user3AccessToken },
  invalidTokens: { user2InvalidToken },
  expiredTokens: { user2ExpiredToken },
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

describe("Member creation", () => {
  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
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
        const { token, includeAuth } = data;

        const payload = { memberId: user2Id, type: "GroupChat" };

        const res = await request.member.post.joinMember(
          groupChatId,
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

  describe("Not Found Errors", () => {
    const scenarios = [
      {
        scenario: "chat does not exist",
        data: {
          chatId: idGenerator(),
          token: user2AccessToken,
          payload: {},
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "user joining a private chat",
        data: {
          token: user3AccessToken,
          payload: {},
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        if (!payload.memberId) {
          payload.memberId = user2Id;
        }

        const res = await request.member.post.joinMember(
          chatId ?? directChatId,
          token,
          payload
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Conflit Errors", () => {
    const scenarios = [
      {
        scenario: "chat membership exist",
        data: {
          token: user1AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 409,
          message: "Chat membership already exist",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 409 (CONFLICT) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;

        const payload = { memberId: user1Id };

        const res = await request.member.post.joinMember(
          groupChatId,
          token,
          payload,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(409);
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
          token: user2AccessToken,
          payload: {
            memberId: idGenerator(),
            type: "GroupChat",
          },
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await request.member.post.joinMember(
          chatId ?? groupChatId,
          token,
          payload
        );

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    it("returns 204 (NO_CONTENT)", async () => {
      const res = await request.member.post.joinMember(
        groupChatId,
        user2AccessToken
      );

      const member = await client.userOnChat.findFirst({
        where: {
          chat: {
            id: groupChatId,
          },
          user: {
            id: user2Id,
          },
        },
        select: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      expect(res.status).toBe(204);
      expect(member).not.toBeNull();
      expect(member.user.id).toBe(user2Id);

      const defaultRole = await client.role.findFirst({
        where: { isDefaultRole: true, chat: { id: groupChatId } },
        select: {
          members: {
            select: {
              user: {
                select: { id: true },
              },
            },
          },
        },
      });

      const toEqualRoleMembers = expect.arrayContaining([
        expect.objectContaining({ user: { id: member.user.id } }),
      ]);

      expect(defaultRole.members).toEqual(toEqualRoleMembers);
    });
  });
});
