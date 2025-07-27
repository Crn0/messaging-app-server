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
  invalidTokens: { user1InvalidToken },
  expiredTokens: { user1ExpiredToken },
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

  await request.member.post.joinMember(
    groupChatResult.body.id,
    user2AccessToken
  );

  groupChatId = groupChatResult.body.id;
  directChatId = directChatResult.body.id;

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

describe("Member detail", () => {
  describe("Member by ID", () => {
    describe("Authentication Errors", () => {
      const scenarios = [
        {
          scenario: "invalid token",
          data: {
            memberId: user2Id,
            token: user1InvalidToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            memberId: user2Id,
            token: user1ExpiredToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            memberId: user2Id,
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
          const { memberId, token, includeAuth } = data;

          const chatId = directChatId;

          const res = await request.member.get.memberById(
            chatId,
            memberId,
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

    describe("Not_Found Errors", () => {
      const scenarios = [
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            memberId: user1Id,
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "member not found",
          data: {
            memberId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Member not found" },
        },
        {
          scenario: "a non-member requesting private chat's member",
          data: {
            memberId: user1Id,
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { memberId, token } = data;

          const chatId = data?.chatId ?? directChatId;

          const res = await request.member.get.memberById(
            chatId,
            memberId,
            token
          );

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      const scenarios = [
        {
          scenario: "a non-member requesting chat's members",
          data: {
            token: user3AccessToken,
            memberId: user1Id,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "View permission denied",
          },
        },
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await request.member.get.memberById(
            chatId ?? groupChatId,
            memberId,
            token
          );

          expect(res.status).toBe(403);
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
            memberId: user1Id,
            token: user1AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "member ID invalid format",
          data: {
            chatId: idGenerator(),
            memberId: "invalid_id_format",
            token: user1AccessToken,
          },
          expectedError: { path: ["memberId"], code: "invalid_string" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await request.member.get.memberById(
            chatId,
            memberId,
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
      describe("Direct chat", () => {
        it("returns 200 (OK) with user object", async () => {
          const res = await request.member.get.memberById(
            directChatId,
            user2Id,
            user1AccessToken
          );

          const toMatchObject = {
            id: expect.any(String),
            username: expect.any(String),
            accountLevel: expect.any(Number),
            status: expect.any(String),
            createdAt: expect.any(String),
            lastSeenAt: null,
            profile: { displayName: expect.any(String), avatar: null },
            serverProfile: {
              mutedUntil: null,
              joinedAt: expect.any(String),
              roles: expect.any(Array),
            },
          };

          expect(res.status).toBe(200);
          expect(res.body).not.toHaveProperty("pk");
          expect(res.body).toMatchObject(toMatchObject);
          expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();
          expect(
            new Date(res.body.serverProfile.joinedAt).getTime()
          ).not.toBeNaN();

          const everyoneRole = await client.role.findFirst({
            where: {
              chat: { id: directChatId },
              isDefaultRole: true,
              name: { contains: "everyone" },
            },
            select: {
              id: true,
            },
          });

          const toEqualRoles = expect.arrayContaining([
            expect.objectContaining({ id: everyoneRole.id }),
          ]);

          expect(res.body.serverProfile.roles).toEqual(toEqualRoles);
        });
      });

      describe("Group chat", () => {
        it("returns 200 (OK) with user object", async () => {
          const res = await request.member.get.memberById(
            groupChatId,
            user2Id,
            user1AccessToken
          );

          const toMatchObject = {
            id: expect.any(String),
            username: expect.any(String),
            accountLevel: expect.any(Number),
            status: expect.any(String),
            createdAt: expect.any(String),
            lastSeenAt: null,
            profile: { displayName: expect.any(String), avatar: null },
            serverProfile: {
              mutedUntil: null,
              joinedAt: expect.any(String),
              roles: expect.any(Array),
            },
          };

          expect(res.status).toBe(200);
          expect(res.body).not.toHaveProperty("pk");
          expect(res.body).toMatchObject(toMatchObject);
          expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();
          expect(
            new Date(res.body.serverProfile.joinedAt).getTime()
          ).not.toBeNaN();

          const everyoneRole = await client.role.findFirst({
            where: {
              chat: { id: groupChatId },
              isDefaultRole: true,
              name: { contains: "everyone" },
            },
            select: {
              id: true,
            },
          });

          const toEqualRoles = expect.arrayContaining([
            expect.objectContaining({ id: everyoneRole.id }),
          ]);

          expect(res.body.serverProfile.roles).toEqual(toEqualRoles);
        });
      });
    });
  });

  describe("Member list", () => {
    describe("Authentication Errors", () => {
      const scenarios = [
        {
          scenario: "invalid token",
          data: {
            token: user1InvalidToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            token: user1ExpiredToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
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
          const { token, includeAuth } = data;

          const res = await request.member.get.memberList(directChatId, token, {
            includeAuth,
          });

          expect(res.status).toBe(401);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not_Found Errors", () => {
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
          scenario: "a non-member requesting private chat's members",
          data: {
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { token, chatId } = data;

          const res = await request.member.get.memberList(
            chatId ?? directChatId,
            token
          );

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      const scenarios = [
        {
          scenario: "a non-member requesting chat's members",
          data: {
            token: user3AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "View permission denied",
          },
        },
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await request.member.get.memberList(
            chatId ?? groupChatId,
            token
          );

          expect(res.status).toBe(403);
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
      it("returns 200 (ok) with the members, memberCount, previous and next href", async () => {
        const res = await request.member.get.memberList(
          groupChatId,
          user1AccessToken
        );

        const { members, memberCount, pagination } = res.body;
        const { prevHref, nextHref } = pagination;

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            id: user1Id,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(members).toEqual(toEqualMembers);
        expect(memberCount).toBeGreaterThan(0);
        expect(prevHref).toBeNull();
        expect(typeof nextHref).toBe("string");
        expect(nextHref).not.toContain("undefined");
      });

      it("paginates the next page with the after query param", async () => {
        const res = await request.member.get.memberList(
          groupChatId,
          user1AccessToken,
          {
            after: user1Id,
          }
        );

        const { members, pagination } = res.body;
        const { prevHref, nextHref } = pagination;

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            id: user2Id,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(members).toEqual(toEqualMembers);
        expect(typeof prevHref).toBe("string");
        expect(prevHref).not.toContain("undefined");
        expect(nextHref).toBeNull();
      });

      it("paginates the previous page with the after query param", async () => {
        const res = await request.member.get.memberList(
          groupChatId,
          user1AccessToken,
          {
            before: user2Id,
          }
        );

        const { members, pagination } = res.body;
        const { prevHref, nextHref } = pagination;

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            id: user1Id,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(members).toEqual(toEqualMembers);
        expect(prevHref).toBeNull();
        expect(typeof nextHref).toBe("string");
        expect(nextHref).not.toContain("undefined");
      });

      it("returns 200 (ok) with all of the members, previous and next href as null when the chat is type of 'DirectChat'", async () => {
        const res = await request.member.get.memberList(
          directChatId,
          user1AccessToken
        );

        const {
          members,
          pagination: { prevHref, nextHref },
        } = res.body;

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            id: user1Id,
            username: expect.any(String),
            accountLevel: expect.any(Number),
            status: expect.any(String),
            createdAt: expect.any(String),
            lastSeenAt: null,
            profile: { displayName: expect.any(String), avatar: null },
          }),
          expect.objectContaining({
            id: user2Id,
            username: expect.any(String),
            accountLevel: expect.any(Number),
            status: expect.any(String),
            createdAt: expect.any(String),
            lastSeenAt: null,
            profile: { displayName: expect.any(String), avatar: null },
          }),
        ]);

        expect(res.status).toBe(200);
        expect(members).toHaveLength(2);
        expect(members).toEqual(toEqualMembers);
        expect(prevHref).toBeNull();
        expect(nextHref).toBeNull();
      });
    });
  });
});
