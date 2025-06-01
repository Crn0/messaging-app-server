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
  accessTokens: { user1AccessToken, user3AccessToken },
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

describe("Chat detail", () => {
  describe("Chat by ID", () => {
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

          const chatId = groupChatId;

          const res = await request.chat.get.chatById(chatId, token, {
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
          scenario: "a non-member viewing chat",
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

          const res = await request.chat.get.chatById(
            chatId ?? groupChatId,
            token
          );

          expect(res.status).toBe(403);
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
          scenario: "user is accessing a private chat they're not member of",
          data: {
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "user is accessing a direct chat they're not member of",
          data: {
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { token } = data;

          const chatId = data?.chatId ?? directChatId;

          const res = await request.chat.get.chatById(chatId, token);

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

          const res = await request.chat.get.chatById(chatId, token);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) with the chat object", async () => {
        const res = await request.chat.get.chatById(
          groupChatId,
          user1AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          avatar: null,
          isPrivate: expect.any(Boolean),
          createdAt: expect.any(String),
          updatedAt: null,
          type: expect.any(String),
          ownerId: expect.any(String),
          roles: expect.any(Array),
        };

        const toEqualRoles = expect.arrayContaining([
          expect.objectContaining({
            name: "everyone",
            roleLevel: null,
            isDefaultRole: true,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("members");
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.roles).toEqual(toEqualRoles);
      });
    });
  });

  describe("Chat list", () => {
    describe("User's chats", () => {
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

            const res = await request.chat.get.chatList(token, {
              includeAuth,
            });

            expect(res.status).toBe(401);
            expect(res.body).toMatchObject(expectedError);
          }
        );
      });

      describe("Success case", () => {
        it("returns 200 (OK) with user's list of chats", async () => {
          const res = await request.chat.get.chatList(user1AccessToken);

          const toEqual = expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              avatar: null,
              isPrivate: false,
              createdAt: expect.any(String),
              updatedAt: null,
              type: "GroupChat",
            }),
            expect.objectContaining({
              id: expect.any(String),
              name: null,
              avatar: null,
              isPrivate: true,
              createdAt: expect.any(String),
              updatedAt: null,
              type: "DirectChat",
            }),
          ]);

          expect(res.status).toBe(200);
          expect(res.body).toHaveLength(2);
          expect(res.body).toEqual(toEqual);
        });
      });
    });

    describe("Public group chats", () => {
      let prevCursor;
      let nextCursor;

      beforeAll(async () => {
        const chats = await client.$transaction(
          Array.from({ length: 20 }).map((_, i) =>
            client.chat.create({
              data: {
                name: `test_public_group_chat${i + 1}`,
                type: "GroupChat",
                isPrivate: false,
                owner: {
                  connect: {
                    id: user1Id,
                  },
                },
              },
            })
          )
        );

        const chatsId = chats.map(({ id }) => id);

        return async () => {
          await client.chat.deleteMany({ where: { id: { in: chatsId } } });
        };
      });

      describe("Authentication Errors", () => {
        const scenarios = [
          {
            scenario: "invalid token",
            data: {
              before: idGenerator(),
              after: idGenerator(),
              token: user1InvalidToken,
              includeAuth: true,
            },
            expectedError: { code: 401, message: "Invalid or expired token" },
          },
          {
            scenario: "expired token",
            data: {
              before: idGenerator(),
              after: idGenerator(),
              token: user1ExpiredToken,
              includeAuth: true,
            },
            expectedError: { code: 401, message: "Invalid or expired token" },
          },
          {
            scenario: "missing 'Authorization' header",
            data: {
              before: idGenerator(),
              after: idGenerator(),
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
            const { before, after, token, includeAuth } = data;

            const res = await request.chat.get.publicChatList(
              before,
              after,
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

      describe("Validation Errors", () => {
        const scenarios = [
          {
            scenario: "before query param invalid format",
            data: {
              before: "invalid_cursor_id",
              after: null,
              token: user1AccessToken,
            },
            expectedError: { path: ["before"], code: "invalid_string" },
          },
          {
            scenario: "after query param invalid format",
            data: {
              before: null,
              after: "invalid_cursor_id",
              token: user1AccessToken,
            },
            expectedError: { path: ["after"], code: "invalid_string" },
          },
        ];

        it.each(scenarios)(
          "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
          async ({ data, expectedError }) => {
            const { before, after, token } = data;

            const res = await request.chat.get.publicChatList(
              before,
              after,
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
        it("returns 200 (OK) with chats, previous and next href", async () => {
          let _;

          const res = await request.chat.get.publicChatList(
            null,
            null,
            user1AccessToken
          );

          const { chats, pagination } = res.body;
          const { prevHref, nextHref } = pagination;

          const toEqualChats = expect.arrayContaining([
            expect.objectContaining({
              isPrivate: false,
            }),
            expect.not.objectContaining({
              isPrivate: true,
            }),
          ]);

          expect(res.status).toBe(200);
          expect(chats).toEqual(toEqualChats);
          expect(typeof nextHref).toBe("string");
          expect(nextHref).not.toContain("undefined");
          expect(prevHref).toBeNull();

          [_, nextCursor] = nextHref.split("=");
        });

        it("paginates the next page with the after query param", async () => {
          let _;

          const res = await request.chat.get.publicChatList(
            null,
            nextCursor,
            user1AccessToken
          );

          const { chats, pagination } = res.body;
          const { prevHref, nextHref } = pagination;

          const toEqualChats = expect.arrayContaining([
            expect.objectContaining({
              isPrivate: false,
            }),
            expect.not.objectContaining({
              isPrivate: true,
            }),
          ]);

          expect(res.status).toBe(200);
          expect(chats).toEqual(toEqualChats);
          expect(typeof prevHref).toBe("string");
          expect(prevHref).not.toContain("undefined");
          expect(typeof nextHref).toBe("string");
          expect(nextHref).not.toContain("undefined");

          [_, prevCursor] = prevHref.split("=");
        });

        it("paginates the previous page with the before query param", async () => {
          let _;

          const res = await request.chat.get.publicChatList(
            prevCursor,
            null,
            user1AccessToken
          );

          const { chats, pagination } = res.body;
          const { prevHref, nextHref } = pagination;

          const toEqualChats = expect.arrayContaining([
            expect.objectContaining({
              isPrivate: false,
            }),
            expect.not.objectContaining({
              isPrivate: true,
            }),
          ]);

          expect(res.status).toBe(200);
          expect(chats).toEqual(toEqualChats);
          expect(prevHref).toBeNull();
          expect(typeof nextHref).toBe("string");
          expect(nextHref).not.toContain("undefined");
        });
      });
    });
  });
});
