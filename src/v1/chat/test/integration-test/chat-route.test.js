import request from "supertest";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import client from "../../../../db/client.js";
import app from "../utils/server.js";
import permissions from "../data/permissions.js";
import Storage from "../../../storage/index.js";
import userFactory from "../utils/user-factory.js";
import baseRequest from "../utils/base-request.js";
import attachment from "../data/file-upload.js";
import { idGenerator } from "../../utils.js";

const TEST_UPLOAD = false;

const user1Req = baseRequest({ request: request(app), url: "/api/v1" });
const user2Req = baseRequest({ request: request(app), url: "/api/v1" });
const user3Req = baseRequest({ request: request(app), url: "/api/v1" });
const user4Req = baseRequest({ request: request(app), url: "/api/v1" });
const user5Req = baseRequest({ request: request(app), url: "/api/v1" });
const nonMemberReq = baseRequest({ request: request(app), url: "/api/v1" });

const storage = Storage();
const User = userFactory();

let groupChatId;

const user1 = await User.create(1);
const user2 = await User.create(1);
const user3 = await User.create(1);
const user4 = await User.create(1);
const user5 = await User.create(1);
const user6 = await User.create(1);

const directChatId = idGenerator();
const privateChatId = idGenerator();

const {
  id: user1Id,
  username: user1Username,
  accessToken: user1AccessToken,
  invalidToken: user1InvalidToken,
  expiredToken: user1ExpiredToken,
} = user1.data;

const {
  id: user2Id,
  username: user2Username,
  accessToken: user2AccessToken,
  invalidToken: user2InvalidToken,
  expiredToken: user2ExpiredToken,
} = user2.data;

const { id: user3Id, accessToken: user3AccessToken } = user3.data;
const { id: user4Id, accessToken: user4AccessToken } = user4.data;
const { id: user5Id, accessToken: user5AccessToken } = user5.data;
const { id: nonMemberId, accessToken: nonMemberAccessToken } = user6.data;

const { entity: user1Entity } = user1;
const { entity: user2Entity } = user2;
const { entity: user3Entity } = user3;
const { entity: user4Entity } = user4;
const { entity: user5Entity } = user5;
const { entity: user6Entity } = user6;

beforeAll(async () => {
  await client.$transaction([
    client.user.create({
      data: {
        ...user1Entity,
      },
    }),
    client.user.create({
      data: {
        ...user2Entity,
      },
    }),
    client.user.create({
      data: {
        ...user3Entity,
      },
    }),
    client.user.create({
      data: {
        ...user4Entity,
      },
    }),
    client.user.create({
      data: {
        ...user5Entity,
      },
    }),
    client.user.create({
      data: {
        ...user6Entity,
      },
    }),
    client.permission.createMany({
      data: permissions.map((name) => ({ name })),
    }),
  ]);

  await client.chat.create({
    data: {
      id: privateChatId,
      name: "test_private_chat",
      isPrivate: true,
      owner: {
        connect: {
          id: user3Id,
        },
      },
      members: {
        create: {
          user: {
            connect: {
              id: user3Id,
            },
          },
        },
      },
      type: "GroupChat",
    },
  });

  return async () => {
    const chatIds = [directChatId, groupChatId, privateChatId].filter(
      (val) => val
    );

    const avatarPath = `${process.env.CLOUDINARY_ROOT_NAME}/avatars/${groupChatId}`;
    const messageAttachmentPath = `${process.env.CLOUDINARY_ROOT_NAME}/messages/${groupChatId}`;

    if (TEST_UPLOAD) {
      await Promise.allSettled([
        storage.destroyFolder(avatarPath),
        // storage.destroyFolder(messageAttachmentPath),
      ])
        .then(console.log)
        .catch(console.error);
    }

    await client.$transaction([
      client.permission.deleteMany({
        where: {
          name: { in: permissions },
        },
      }),
      client.chat.deleteMany({
        where: {
          id: { in: chatIds },
        },
      }),
      client.user.deleteMany({
        where: {
          id: {
            in: [user1Id, user2Id, user3Id, user4Id, user5Id, nonMemberId],
          },
        },
      }),
    ]);
  };
});

describe("Chat creation", () => {
  const diretChatForm = {
    chatId: directChatId,
    type: "DirectChat",
    memberIds: [user1Id, user2Id],
  };

  const groupChatForm = {
    ownerId: user1Id,
    name: "test_group_chat",
    type: "GroupChat",
  };

  const groupChatWithAvatarForm = {
    ownerId: user1Id,
    name: "test_group_chat_with_avatar",
    avatar: attachment.avatar,
    type: "GroupChat",
  };

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          token: user1InvalidToken,
          payload: {},
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          token: user1ExpiredToken,
          payload: {},
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          token: user1AccessToken,
          payload: {},
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

        const res = await user1Req.chat.post.chat(token, payload, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Direct chat", () => {
    beforeAll(async () => {
      await client.user.update({
        where: {
          id: user2Id,
        },
        data: {
          blockedUsers: {
            connect: {
              id: user3Id,
            },
          },
        },
      });

      return async () =>
        client.user.update({
          where: {
            id: user2Id,
          },
          data: {
            blockedUsers: {
              set: [],
            },
          },
        });
    });

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "creating a direct message to a blocked user",
          req: user2Req,
          data: {
            token: user2AccessToken,
            includeAuth: true,
            payload: {
              chatId: idGenerator(),
              type: "DirectChat",
              memberIds: [user2Id, user3Id],
            },
          },
          expectedError: {
            code: 403,
            message:
              "Action not allowed because one of the users has blocked the other",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { payload, token } = data;

          const res = await req.chat.post.chat(token, payload);

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "invalid chat type",
          data: {
            token: user1AccessToken,
            payload: {
              type: "invalidType",
            },
          },
          expectedError: { path: ["type"], code: "invalid_enum_value" },
        },
        {
          scenario: "chat ID field is not in UUID format",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: "",
              type: "DirectChat",
              memberIds: [user1Id, user2Id],
            },
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "chat ID field is undefined",
          data: {
            token: user1AccessToken,
            payload: {
              type: "DirectChat",
              memberIds: [user1Id, user2Id],
            },
          },
          expectedError: { path: ["chatId"], code: "invalid_type" },
        },
        {
          scenario: "members ID too small",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: directChatId,
              type: "DirectChat",
              memberIds: [user1Id],
            },
          },
          expectedError: { path: ["memberIds"], code: "too_small" },
        },
        {
          scenario: "members ID too big",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: directChatId,
              type: "DirectChat",
              memberIds: [user1Id, user2Id, user1Id],
            },
          },
          expectedError: { path: ["memberIds"], code: "too_big" },
        },
        {
          scenario: "index 0 of members ID is not a valid UUID",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: directChatId,
              memberIds: ["", user2Id],
              type: "DirectChat",
            },
          },
          expectedError: { path: ["memberIds", 0], code: "invalid_string" },
        },
        {
          scenario: "members ID field is undefined",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: directChatId,
              type: "DirectChat",
            },
          },
          expectedError: { path: ["memberIds"], code: "invalid_type" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { token, payload } = data;

          const res = await user1Req.chat.post.chat(token, payload);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) and the chat object", async () => {
        const res = await user1Req.chat.post.chat(
          user1AccessToken,
          diretChatForm
        );

        const toMatchObject = {
          id: expect.any(String),
          name: null,
          avatar: null,
          isPrivate: expect.any(Boolean),
          createdAt: expect.any(String),
          updatedAt: null,
          type: expect.any(String),
        };

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.isPrivate).toBeTruthy();
        expect(res.body.type).toBe("DirectChat");

        const members = await client.userOnChat.findMany({
          where: {
            chat: { id: res.id },
          },
          select: {
            roles: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                username: true,
              },
            },
          },
        });

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            roles: [{ name: "everyone" }],
            user: { username: user1Username },
          }),
          expect.objectContaining({
            roles: [{ name: "everyone" }],
            user: { username: user2Username },
          }),
        ]);

        expect(members).toEqual(toEqualMembers);
      });
    });

    describe("Conflit Errors", () => {
      it.each([
        {
          scenario: "A direct-chat exist between the specified users",
          data: {
            token: user1AccessToken,
            payload: {
              chatId: idGenerator(),
              type: "DirectChat",
              memberIds: [user1Id, user2Id],
            },
            includeAuth: true,
          },
          expectedError: {
            code: 409,
            message: "Direct chat already exists",
          },
        },
      ])(
        "fails with 409 (CONFLICT) for $scenario",
        async ({ data, expectedError }) => {
          const { token, payload, includeAuth } = data;

          const res = await user1Req.chat.post.chat(token, payload, {
            includeAuth,
          });

          expect(res.status).toBe(409);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });
  });

  describe("Group chat", () => {
    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "invalid chat type",
          payload: {
            type: "invalidType",
          },
          expectedError: { path: ["type"], code: "invalid_enum_value" },
        },
        {
          scenario: "owner ID field is not in UUID format",
          payload: {
            ownerId: "",
            type: "GroupChat",
          },
          expectedError: { path: ["ownerId"], code: "invalid_string" },
        },
        {
          scenario: "name is over 100 characters",
          payload: {
            ownerId: user1Id,
            name: Array.from({ length: 100 }, () => "foo").join(""),
            type: "GroupChat",
          },
          expectedError: { path: ["name"], code: "too_big" },
        },
        {
          scenario: "avatar invalid mimetype",
          payload: {
            ownerId: user1Id,
            name: "test",
            avatar: attachment.catGif,
            type: "GroupChat",
          },
          expectedError: { path: ["avatar", "mimetype"], code: "custom" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ payload, expectedError }) => {
          const res = await user1Req.chat.post.chat(user1AccessToken, payload);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) and the chat object", async () => {
        const res = await user1Req.chat.post.chat(
          user1AccessToken,
          groupChatForm
        );

        const toMatchObject = {
          id: expect.any(String),
          ownerId: expect.any(String),
          name: expect.any(String),
          avatar: null,
          type: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: null,
        };

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.name).toBe(groupChatForm.name);
        expect(res.body.ownerId).toBe(user1Id);
        expect(res.body.type).toBe("GroupChat");

        groupChatId = res.body.id;

        const members = await client.userOnChat.findMany({
          where: {
            chat: { id: res.id },
          },
          select: {
            roles: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                username: true,
              },
            },
          },
        });

        const toEqualMembers = expect.arrayContaining([
          expect.objectContaining({
            roles: [{ name: "everyone" }],
            user: { username: user1Username },
          }),
        ]);

        expect(members).toEqual(toEqualMembers);
      });

      it.skipIf(TEST_UPLOAD === false)(
        "creates a chat with avatar and returns the chat object",
        async () => {
          const res = await user1Req.chat.post.chat(
            user1AccessToken,
            groupChatWithAvatarForm
          );

          const members = await client.userOnChat.findMany({
            where: {
              chat: { id: res.id },
            },
            select: {
              roles: {
                select: {
                  name: true,
                },
              },
              user: {
                select: {
                  username: true,
                },
              },
            },
          });

          const toEqualMembers = expect.arrayContaining([
            expect.objectContaining({
              roles: [{ name: "everyone" }],
              user: { username: user1Username },
            }),
          ]);

          const avatarPath = `${process.env.CLOUDINARY_ROOT_NAME}/avatars/${res.body.id}`;

          const toMatchObject = {
            id: expect.any(String),
            name: expect.any(String),
            avatar: expect.any(Object),
            isPrivate: expect.any(Boolean),
            createdAt: expect.any(String),
            updatedAt: null,
            type: expect.any(String),
            ownerId: expect.any(String),
          };

          expect(res.status).toBe(200);
          expect(res.body).not.toHaveProperty("pk");
          expect(res.body).toMatchObject(toMatchObject);
          expect(res.body.name).toBe(groupChatWithAvatarForm.name);
          expect(res.body.ownerId).toBe(user1Id);
          expect(res.body.type).toBe("GroupChat");
          expect(members).toEqual(toEqualMembers);

          await client.chat.delete({ where: { id: res.body.id } });
          await storage
            .destroyFolder(avatarPath)
            .then(console.log)
            .catch(console.error);
        }
      );
    });
  });
});

describe("Chat detail", () => {
  describe("Chat by ID", () => {
    describe("Authentication Errors", () => {
      it.each([
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
      ])(
        "fails with 401 (UNAUTHORIZED) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token, includeAuth } = data;

          const res = await user1Req.chat.get.chatById(chatId, token, {
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
          scenario: "a non-member viewing chat",
          req: user3Req,
          data: {
            token: user3AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "View permission denied",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, token } = data;

          const res = await req.chat.get.chatById(chatId ?? groupChatId, token);

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not_Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          req: user1Req,
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario:
            "user is accessing a private group chat they're not member of",
          req: user2Req,
          data: {
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "user is accessing a direct chat they're not member of",
          req: user3Req,
          data: {
            chatId: directChatId,
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])(
        "fails with 404 for $scenario",
        async ({ req, data, expectedError }) => {
          const { token, chatId } = data;

          const res = await req.chat.get.chatById(
            chatId ?? privateChatId,
            token
          );

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await user1Req.chat.get.chatById(chatId, token);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) with the chat object", async () => {
        const res = await user1Req.chat.get.chatById(
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
        it.each([
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
        ])(
          "fails with 401 (UNAUTHORIZED) for $scenario",
          async ({ data, expectedError }) => {
            const { token, includeAuth } = data;

            const res = await user1Req.chat.get.chatList(token, {
              includeAuth,
            });

            expect(res.status).toBe(401);
            expect(res.body).toMatchObject(expectedError);
          }
        );
      });

      describe("Success case", () => {
        it("returns 200 (OK) with user's list of chats", async () => {
          const res = await user1Req.chat.get.chatList(user1AccessToken);

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
        it.each([
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
        ])(
          "fails with 401 (UNAUTHORIZED) for $scenario",
          async ({ data, expectedError }) => {
            const { before, after, token, includeAuth } = data;

            const res = await user1Req.chat.get.publicChatList(
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
        it.each([
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
        ])(
          "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
          async ({ data, expectedError }) => {
            const { before, after, token } = data;

            const res = await user1Req.chat.get.publicChatList(
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

          const res = await user1Req.chat.get.publicChatList(
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

          const res = await user1Req.chat.get.publicChatList(
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

          const res = await user1Req.chat.get.publicChatList(
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

describe("Chat update", () => {
  const form = { avatar: attachment.avatar, type: "GroupChat" };

  beforeAll(async () => {
    const member = await client.userOnChat.create({
      data: {
        chat: {
          connect: {
            id: groupChatId,
          },
        },
        user: {
          connect: {
            id: user2Id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return async () => client.userOnChat.delete({ where: { id: member.id } });
  });

  describe("Update name", () => {
    describe("Authentication Errors", () => {
      it.each([
        {
          scenario: "invalid token",
          data: {
            chatId: directChatId,
            token: user1InvalidToken,
            includeAuth: true,
            payload: {
              name: "updated_group_chat_name",
            },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            chatId: directChatId,
            token: user1ExpiredToken,
            includeAuth: true,
            payload: {
              name: "updated_group_chat_name",
            },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            chatId: directChatId,
            token: user1AccessToken,
            includeAuth: false,
            payload: {
              name: "updated_group_chat_name",
            },
          },
          expectedError: {
            code: 401,
            message: "Required 'Authorization' header is missing",
          },
        },
      ])(
        "fails with 401 (UNAUTHORIZED) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token, includeAuth } = data;

          const res = await user1Req.chat.patch.name(chatId, payload, token, {
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
          scenario: "a non-member tries to update a group chat name",
          req: user3Req,
          data: {
            token: user3AccessToken,
            includeAuth: true,
            payload: {
              name: "updated_group_chat_name",
            },
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to modify name",
          },
        },
        {
          scenario: "a member without admin rights tries to rename",
          req: user2Req,
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
          req: user2Req,
          data: {
            chatId: directChatId,
            token: user2AccessToken,
            includeAuth: true,
            payload: { name: "unauthorized_rename" },
          },
          expectedError: {
            code: 403,
            message: "Direct chat cannot be modified",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, payload, token } = data;

          const res = await req.chat.patch.name(
            chatId ?? groupChatId,
            payload,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
            payload: {
              name: "updated_group_chat_name",
            },
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await user1Req.chat.patch.name(chatId, payload, token);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
            payload: {
              name: "updated_group_chat_name",
            },
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
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;

          const res = await user1Req.chat.patch.name(
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

        const res = await user1Req.chat.patch.name(
          groupChatId,
          payload,
          user1AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          avatar: null,
          isPrivate: expect.any(Boolean),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          type: expect.any(String),
          ownerId: expect.any(String),
          roles: expect.any(Array),
        };

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.name).toBe(payload.name);
        expect(res.body.type).toBe("GroupChat");
        expect(new Date(res.body.updatedAt)).toBeInstanceOf(Date);
      });
    });
  });

  describe.skipIf(TEST_UPLOAD === false)("Update avatar", () => {
    describe("Authentication Errors", () => {
      it.each([
        {
          scenario: "invalid token",
          data: {
            token: user1InvalidToken,
            includeAuth: true,
            payload: {
              avatar: attachment.avatar,
              type: "GroupChat",
            },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            token: user1ExpiredToken,
            includeAuth: true,
            payload: {
              avatar: attachment.avatar,
              type: "GroupChat",
            },
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            token: user1AccessToken,
            includeAuth: false,
            payload: {
              avatar: attachment.avatar,
              type: "GroupChat",
            },
          },
          expectedError: {
            code: 401,
            message: "Required 'Authorization' header is missing",
          },
        },
      ])(
        "fails with 401 (UNAUTHORIZED) for $scenario",
        async ({ data, expectedError }) => {
          const { payload, token, includeAuth } = data;

          const res = await user1Req.chat.patch.avatar(
            groupChatId,
            payload,
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

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "a non-member tries to update a group chat avatar",
          req: user3Req,
          data: {
            token: user3AccessToken,
            includeAuth: true,
            payload: {
              avatar: attachment.avatar,
              type: "GroupChat",
            },
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to modify avatar",
          },
        },
        {
          scenario: "a member without admin rights tries to update chat avatar",
          req: user2Req,
          data: {
            token: user2AccessToken,
            includeAuth: true,
            payload: {
              avatar: attachment.avatar,
              type: "GroupChat",
            },
          },
          expectedError: {
            code: 403,
            message: "Missing permission: manage_chat or admin",
          },
        },
        {
          scenario: "a member trying to update direct chat avatar",
          req: user2Req,
          data: {
            chatId: directChatId,
            token: user2AccessToken,
            includeAuth: true,
            payload: {
              avatar: attachment.avatar,
              type: "DirectChat",
            },
          },
          expectedError: {
            code: 403,
            message: "Direct chat cannot be modified",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, payload, token } = data;

          const res = await req.chat.patch.avatar(
            chatId ?? groupChatId,
            payload,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
            payload: {
              avatar: attachment.avatar,
              type: "DirectChat",
            },
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await user1Req.chat.patch.avatar(chatId, payload, token);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
            payload: {
              avatar: attachment.avatar,
              type: "DirectChat",
            },
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "avatar invalid mimetype",
          data: {
            token: user1AccessToken,
            payload: {
              avatar: attachment.catGif,
              type: "DirectChat",
            },
          },
          expectedError: { path: ["avatar", "mimetype"], code: "custom" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, payload, token } = data;

          const res = await user1Req.chat.patch.avatar(
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
      it("returns 200 (OK) with the updated chat", async () => {
        const res = await user1Req.chat.patch.avatar(
          groupChatId,
          form,
          user1AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          avatar: expect.any(Object),
          isPrivate: expect.any(Boolean),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          type: expect.any(String),
          ownerId: expect.any(String),
          roles: expect.any(Array),
        };

        const toMatchAvatar = {
          url: expect.any(String),
          images: expect.any(Array),
        };

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.avatar).toMatchObject(toMatchAvatar);
      });
    });
  });
});

describe.skip("Chat deletion", () => {
  let chatIdToDelete;

  beforeAll(async () => {
    const form = {
      ownerId: user1Id,
      name: "test_group_chat",
      type: "GroupChat",
    };

    const res = await user1Req.chat.post.chat(user1AccessToken, form);

    chatIdToDelete = res.body.id;

    await client.userOnChat.create({
      data: {
        chat: {
          connect: {
            id: chatIdToDelete,
          },
        },
        user: {
          connect: {
            id: user2Id,
          },
        },
      },
      select: {
        id: true,
      },
    });
  });

  describe("Authentication Errors", () => {
    it.each([
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
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, token, includeAuth } = data;

        const res = await user1Req.chat.delete.deleteChat(chatId, token, {
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
        scenario: "a non-member tries to delete a group chat",
        req: user3Req,
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
        req: user2Req,
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
        req: user2Req,
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
    ])(
      "fails with 403 when $scenario",
      async ({ req, data, expectedError }) => {
        const { chatId, token } = data;
        const res = await req.chat.delete.deleteChat(
          chatId ?? chatIdToDelete,
          token
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Not Found Errors", () => {
    it.each([
      {
        scenario: "chat does not exist",
        req: user1Req,
        data: {
          chatId: idGenerator(),
          token: user1AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "user deleting a direct chat they're not a member",
        req: user3Req,
        data: {
          token: user3AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ])("fails with 404 for $scenario", async ({ req, data, expectedError }) => {
      const { chatId, token } = data;

      const res = await req.chat.delete.deleteChat(
        chatId ?? directChatId,
        token
      );

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject(expectedError);
    });
  });

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "chat ID invalid format",
        data: {
          chatId: "invalid_id_format",
          token: user1AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, token } = data;

        const res = await user1Req.chat.delete.deleteChat(chatId, token);

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    it("returns 204 (NO_CONTENT)", async () => {
      const res = await user1Req.chat.delete.deleteChat(
        chatIdToDelete,
        user1AccessToken
      );

      expect(res.status).toBe(204);

      expect(
        await client.chat.findUnique({ where: { id: chatIdToDelete } })
      ).toBeNull();
    });
  });
});

describe("Member creation", () => {
  describe("Authentication Errors", () => {
    it.each([
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
    ])(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;

        const payload = { memberId: user2Id, type: "GroupChat" };

        const res = await user1Req.member.post.joinMember(
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
    it.each([
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
          token: user2AccessToken,
          payload: {},
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
      const { chatId, payload, token } = data;

      if (!payload.memberId) {
        payload.memberId = user2Id;
      }

      const res = await user1Req.member.post.joinMember(
        chatId ?? privateChatId,
        token,
        payload
      );

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject(expectedError);
    });
  });

  describe("Conflit Errors", () => {
    it.each([
      {
        scenario: "chat membership exist",
        data: {
          token: user3AccessToken,

          includeAuth: true,
        },
        expectedError: {
          code: 409,
          message: "Chat membership already exist",
        },
      },
    ])(
      "fails with 409 (CONFLICT) for $scenario",
      async ({ data, expectedError }) => {
        const { token, includeAuth } = data;

        const payload = { memberId: user1Id };

        const res = await user1Req.member.post.joinMember(
          privateChatId,
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
    it.each([
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
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await user1Req.member.post.joinMember(
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
      const res = await user2Req.member.post.joinMember(
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

describe("Member detail", () => {
  describe("Member by ID", () => {
    describe("Not_Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          req: user1Req,
          data: {
            chatId: idGenerator(),
            memberId: user1Id,
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "member not found",
          req: user1Req,
          data: {
            chatId: directChatId,
            memberId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Member not found" },
        },
        {
          scenario: "a non-member requesting private chat's member",
          req: user3Req,
          data: {
            chatId: directChatId,
            memberId: user1Id,
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])(
        "fails with 404 for $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await req.member.get.memberById(chatId, memberId, token);

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "a non-member requesting chat's members",
          req: user3Req,
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
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await req.member.get.memberById(
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
      it.each([
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
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await user1Req.member.get.memberById(
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
          const res = await user1Req.member.get.memberById(
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
          const res = await user1Req.member.get.memberById(
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
    describe("Not_Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          req: user1Req,
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "a non-member requesting private chat's members",
          req: user3Req,
          data: {
            chatId: directChatId,
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])(
        "fails with 404 for $scenario",
        async ({ req, data, expectedError }) => {
          const { token, chatId } = data;

          const res = await req.member.get.memberList(
            chatId ?? privateChatId,
            token
          );

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "a non-member requesting chat's members",
          req: user3Req,
          data: {
            token: user3AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "View permission denied",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, token } = data;

          const res = await req.member.get.memberList(
            chatId ?? groupChatId,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await user1Req.chat.delete.deleteChat(chatId, token);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (ok) with the members, previous and next href", async () => {
        const res = await user1Req.member.get.memberList(
          groupChatId,
          user1AccessToken
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

      it("paginates the next page with the after query param", async () => {
        const res = await user1Req.member.get.memberList(
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
        const res = await user1Req.member.get.memberList(
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
    });
  });
});

describe("Member update", () => {
  describe("Muted until", () => {
    let muteRoleId;
    let normalMember1Id;
    let normalMember2Id;

    beforeAll(async () => {
      const defaultRole = await client.role.findFirst({
        where: { isDefaultRole: true, chat: { id: groupChatId } },
      });

      const [highestRoleLevel, highestRole, muteRole] =
        await client.$transaction([
          client.role.create({
            data: {
              name: "test_admin_role",
              roleLevel: 2,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "admin",
                },
              },
            },
          }),
          client.role.create({
            data: {
              name: "test_higher_role",
              roleLevel: 1,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "mute_member",
                },
              },
            },
          }),
          client.role.create({
            data: {
              name: "test_mute_role",
              roleLevel: 3,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "mute_member",
                },
              },
            },
          }),
        ]);

      const memberWithAdminRole = await client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user2Id } },
        select: {
          id: true,
        },
      });

      const [memberWithHighestRole, normalMember1, normalMember2] =
        await client.$transaction([
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user3Id },
              },
              roles: { connect: { id: highestRole.id } },
            },
          }),
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user4Id },
              },
              roles: { connect: { id: defaultRole.id } },
            },
          }),
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user5Id },
              },
              roles: { connect: { id: defaultRole.id } },
            },
          }),
          client.userOnChat.update({
            where: {
              id: memberWithAdminRole.id,
            },
            data: {
              roles: {
                connect: {
                  id: highestRoleLevel.id,
                },
              },
            },
          }),
        ]);

      muteRoleId = muteRole.id;
      normalMember1Id = normalMember1.id;
      normalMember2Id = normalMember2.id;

      return async () => {
        const memberIds = [
          normalMember1.id,
          normalMember2.id,
          memberWithHighestRole.id,
        ];

        const roleIds = [highestRoleLevel.id, highestRole.id, muteRole.id];

        await client.$transaction([
          client.userOnChat.deleteMany({
            where: { id: { in: memberIds } },
          }),
          client.role.deleteMany({
            where: { id: { in: roleIds } },
          }),
        ]);
      };
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            memberId: user2Id,
            token: user1AccessToken,
            payload: { mutedUntil: null },
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "member does not exist",
          data: {
            memberId: nonMemberId,
            token: user1AccessToken,
            payload: { mutedUntil: null },
          },
          expectedError: { code: 404, message: "Member not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, memberId, payload, token } = data;

        const res = await user1Req.member.patch.mutedUntil(
          chatId ?? groupChatId,
          memberId,
          payload,
          token
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            memberId: user2Id,
            token: user1AccessToken,
            payload: {
              mutedUntil: null,
            },
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "member ID invalid format",
          data: {
            token: user1AccessToken,
            memberId: "invalid_id_format",
            payload: {
              mutedUntil: null,
            },
          },
          expectedError: { path: ["memberId"], code: "invalid_string" },
        },
        {
          scenario: "mutedUntil is not a datetime",
          data: {
            token: user1AccessToken,
            memberId: user2Id,
            payload: {
              mutedUntil: "",
            },
          },
          expectedError: { path: ["mutedUntil"], code: "invalid_string" },
        },
        {
          scenario: "mutedUntil is less than a minute",
          data: {
            token: user1AccessToken,
            memberId: user2Id,
            payload: {
              mutedUntil: new Date(Date.now() + 59 * 1000).toISOString(),
            },
          },
          expectedError: { path: ["mutedUntil"], code: "custom" },
        },
        {
          scenario: "mutedUntil is greater than seven days",
          data: {
            token: user1AccessToken,
            memberId: user2Id,
            payload: {
              mutedUntil: new Date(
                Date.now() + 10 * 24 * 60 * 60 * 1000
              ).toISOString(),
            },
          },
          expectedError: { path: ["mutedUntil"], code: "custom" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, payload, token } = data;

          const res = await user1Req.member.patch.mutedUntil(
            chatId ?? groupChatId,
            memberId,
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

    describe("Mute member", () => {
      const validForm = { mutedUntil: new Date(Date.now() + 71 * 1000) };

      describe("Forbidden Errors", () => {
        it.each([
          {
            scenario: "a non-member tries to mute a chat member",
            req: nonMemberReq,
            data: {
              memberId: user2Id,
              token: nonMemberAccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "You must be a chat member to mute others",
            },
          },
          {
            scenario: "member role without permission attempts to mute user",
            req: user4Req,
            data: {
              memberId: user4Id,
              token: user4AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "Missing permission: admin or mute_member",
            },
          },
          {
            scenario:
              "member role with permission equal to target user role level attempts to mute user",
            req: user3Req,
            data: {
              memberId: user3Id,
              token: user3AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message:
                "You cannot mute a member with higher or equal role level",
            },
          },
          {
            scenario: "a owner trying to mute a user that has admin permission",
            req: user1Req,
            data: {
              memberId: user2Id,
              token: user1AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "You cannot mute an admin member",
            },
          },
          {
            scenario: "a user trying to mute the chat owner",
            req: user2Req,
            data: {
              memberId: user1Id,
              token: user2AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "You cannot mute the chat owner",
            },
          },
          {
            scenario: "a user trying to mute a higher ranked member",
            req: user2Req,
            data: {
              memberId: user3Id,
              token: user2AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "You cannot mute a member with higher role level",
            },
          },
        ])(
          "fails with 403 when $scenario",
          async ({ req, data, expectedError }) => {
            const { chatId, memberId, payload, token } = data;

            const res = await req.member.patch.mutedUntil(
              chatId ?? groupChatId,
              memberId,
              payload,
              token
            );

            expect(res.status).toBe(403);
            expect(res.body).toMatchObject(expectedError);
          }
        );
      });

      describe("Success case", () => {
        beforeAll(async () => {
          await client.userOnChat.update({
            where: {
              id: normalMember1Id,
            },
            data: {
              roles: {
                connect: {
                  id: muteRoleId,
                },
              },
            },
            select: {
              user: { select: { id: true } },
            },
          });

          return async () =>
            client.role.update({
              where: { id: muteRoleId },
              data: {
                members: {
                  disconnect: [normalMember1Id].map((id) => ({
                    id,
                  })),
                },
              },
            });
        });

        it("returns 204 (NO_CONTENT) when the owner mutes the highest role member", async () => {
          const res = await user1Req.member.patch.mutedUntil(
            groupChatId,
            user3Id,
            validForm,
            user1AccessToken
          );

          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user3Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(new Date(mutedMember.mutedUntil).getTime()).not.toBeNull();
          expect(new Date(mutedMember.mutedUntil).getTime()).equals(
            validForm.mutedUntil.getTime()
          );
        });

        it("returns 204 (NO_CONTENT) when a higher role member mutes a lower role member", async () => {
          const res = await user3Req.member.patch.mutedUntil(
            groupChatId,
            user4Id,
            validForm,
            user3AccessToken
          );

          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user4Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(new Date(mutedMember.mutedUntil).getTime()).not.toBeNull();
          expect(new Date(mutedMember.mutedUntil).getTime()).equals(
            validForm.mutedUntil.getTime()
          );
        });

        it("returns 204 (NO_CONTENT) when a member with 'mute_member' permission mutes a normal member", async () => {
          const res = await user4Req.member.patch.mutedUntil(
            groupChatId,
            user5Id,
            validForm,
            user4AccessToken
          );
          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user5Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(new Date(mutedMember.mutedUntil).getTime()).not.toBeNull();
          expect(new Date(mutedMember.mutedUntil).getTime()).equals(
            validForm.mutedUntil.getTime()
          );
        });
      });
    });

    describe("Unmute member", () => {
      const validForm = { mutedUntil: null };

      describe("Forbidden Errors", () => {
        it.each([
          {
            scenario: "a non-member tries to unmute a chat member",
            req: nonMemberReq,
            data: {
              memberId: user2Id,
              payload: validForm,
              token: nonMemberAccessToken,
              includeAuth: true,
            },
            expectedError: {
              code: 403,
              message: "You must be a chat member to unmute others",
            },
          },
          {
            scenario: "member role without permission attempts to unmute user",
            req: user4Req,
            data: {
              memberId: user4Id,
              token: user4AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message: "Missing permission: admin or mute_member",
            },
          },
          {
            scenario:
              "member role with permission equal to target user role level attempts to unmute user",
            req: user3Req,
            data: {
              memberId: user3Id,
              token: user3AccessToken,
              includeAuth: true,
              payload: validForm,
            },
            expectedError: {
              code: 403,
              message:
                "You cannot unmute a member with higher or equal role level",
            },
          },
          {
            scenario: "a user trying to unmute a higher ranked member",
            req: user2Req,
            data: {
              memberId: user3Id,
              payload: validForm,
              token: user2AccessToken,
              includeAuth: true,
            },
            expectedError: {
              code: 403,
              message: "You cannot unmute a member with higher role level",
            },
          },
        ])(
          "fails with 403 when $scenario",
          async ({ req, data, expectedError }) => {
            const { chatId, memberId, payload, token } = data;

            const res = await req.member.patch.mutedUntil(
              chatId ?? groupChatId,
              memberId,
              payload,
              token
            );

            expect(res.status).toBe(403);
            expect(res.body).toMatchObject(expectedError);
          }
        );
      });

      describe("Success case", () => {
        beforeAll(async () => {
          await client.userOnChat.update({
            where: {
              id: normalMember1Id,
            },
            data: {
              roles: {
                connect: {
                  id: muteRoleId,
                },
              },
            },
            select: {
              user: { select: { id: true } },
            },
          });

          return async () =>
            client.role.update({
              where: { id: muteRoleId },
              data: {
                members: {
                  disconnect: [normalMember1Id].map((id) => ({
                    id,
                  })),
                },
              },
            });
        });

        it("returns 204 (NO_CONTENT) when the owner unmutes the highest role member", async () => {
          const res = await user1Req.member.patch.mutedUntil(
            groupChatId,
            user3Id,
            validForm,
            user1AccessToken
          );

          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user3Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(mutedMember.mutedUntil).toBeNull();
        });

        it("returns 204 (NO_CONTENT) when a higher role member mutes a lower role member", async () => {
          const res = await user3Req.member.patch.mutedUntil(
            groupChatId,
            user4Id,
            validForm,
            user3AccessToken
          );

          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user4Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(mutedMember.mutedUntil).toBeNull();
        });

        it("returns 204 (NO_CONTENT) when a member with 'mute_member' permission unmute a normal member", async () => {
          const res = await user4Req.member.patch.mutedUntil(
            groupChatId,
            user5Id,
            validForm,
            user4AccessToken
          );

          expect(res.status).toBe(204);

          const mutedMember = await client.userOnChat.findFirst({
            where: {
              chat: { id: groupChatId },
              user: { id: user5Id },
            },
            select: {
              id: true,
              mutedUntil: true,
            },
          });

          expect(mutedMember.mutedUntil).toBeNull();
        });
      });
    });
  });
});

describe("Member deletion", () => {
  describe("Member leaving", () => {
    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, token } = data;

        const res = await user1Req.member.delete.leaveChat(
          chatId ?? groupChatId,
          token
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user1AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await user1Req.member.delete.leaveChat(
            chatId ?? groupChatId,
            token
          );

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "non-member tries to leave chat",
          req: nonMemberReq,
          data: {
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "Must be member to leave chat",
          },
        },
        {
          scenario: "chat owner tries to leave chat",
          req: user1Req,
          data: {
            token: user1AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "Must transfer chat ownership before you can leave",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, token } = data;

          const res = await req.member.delete.leaveChat(
            chatId ?? groupChatId,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Success case", () => {
      it("returns 204 (NO_CONTENT)", async () => {
        await client.userOnChat.create({
          data: {
            chat: {
              connect: { id: groupChatId },
            },
            user: {
              connect: { id: user4Id },
            },
          },
        });

        const res = await user4Req.member.delete.leaveChat(
          groupChatId,
          user4AccessToken
        );

        expect(res.status).toBe(204);

        const member = await client.userOnChat.findFirst({
          where: { chat: { id: groupChatId }, user: { id: user4Id } },
        });

        expect(member).toBeNull();
      });
    });
  });

  describe("Member kick", () => {
    let highestRoleLevelId;

    beforeAll(async () => {
      const [highestRoleLevel, highestRole, kickRole] =
        await client.$transaction([
          client.role.create({
            data: {
              name: "test_admin_role",
              roleLevel: 2,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "admin",
                },
              },
            },
          }),
          client.role.create({
            data: {
              name: "test_higher_role",
              roleLevel: 1,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "admin",
                },
              },
            },
          }),
          client.role.create({
            data: {
              name: "test_kick_role",
              roleLevel: 3,
              isDefaultRole: false,
              chat: {
                connect: {
                  id: groupChatId,
                },
              },
              permissions: {
                connect: {
                  name: "admin",
                },
              },
            },
          }),
        ]);

      const memberWithAdminRole = await client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user2Id } },
        select: {
          id: true,
        },
      });

      const [memberWithHighestRole, memberWithKickRole1, memberWithKickRole2] =
        await client.$transaction([
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user3Id },
              },
              roles: {
                connect: { id: highestRole.id },
              },
            },
          }),
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user4Id },
              },
              roles: {
                connect: { id: kickRole.id },
              },
            },
          }),
          client.userOnChat.create({
            data: {
              chat: {
                connect: { id: groupChatId },
              },
              user: {
                connect: { id: user5Id },
              },
              roles: {
                connect: { id: kickRole.id },
              },
            },
          }),
          client.userOnChat.update({
            where: {
              id: memberWithAdminRole.id,
            },
            data: {
              roles: {
                connect: {
                  id: highestRoleLevel.id,
                },
              },
            },
          }),
        ]);

      highestRoleLevelId = highestRoleLevel.id;

      return async () => {
        const memberIds = [
          memberWithKickRole1.id,
          memberWithKickRole2.id,
          memberWithHighestRole.id,
        ];

        const roleIds = [highestRoleLevel.id, highestRole.id, kickRole.id];

        await client.$transaction([
          client.userOnChat.deleteMany({
            where: { id: { in: memberIds } },
          }),
          client.role.deleteMany({
            where: { id: { in: roleIds } },
          }),
        ]);
      };
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            memberId: user2Id,
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "member does not exist",
          data: {
            memberId: nonMemberId,
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Member not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, memberId, token } = data;

        const res = await user1Req.member.delete.kickMember(
          chatId ?? groupChatId,
          memberId,
          token
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            memberId: user2Id,
            token: user1AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "member ID invalid format",
          data: {
            memberId: "invalid_id_format",
            token: user1AccessToken,
          },
          expectedError: { path: ["memberId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await user1Req.member.delete.kickMember(
            chatId ?? groupChatId,
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

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "non-member tries to kick a member",
          req: nonMemberReq,
          data: {
            memberId: user2Id,
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to kick others",
          },
        },
        {
          scenario: "kicking a member who has equal role level",
          req: user1Req,
          data: {
            memberId: user5Id,
            token: user4AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You cannot kick a member with higher or equal role level",
          },
        },
        {
          scenario: "kicking a member who has higher role level",
          req: user4Req,
          data: {
            memberId: user3Id,
            token: user4AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You cannot kick a member with higher or equal role level",
          },
        },
        {
          scenario: "kicking the chat owner",
          req: user1Req,
          data: {
            memberId: user1Id,
            token: user1AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You cannot kick the chat owner",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await req.member.delete.kickMember(
            chatId ?? groupChatId,
            memberId,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Success case", () => {
      it("returns 204 (NO_CONTENT) when a member with a higher role and 'admin' permission kicks another member", async () => {
        const kickedMember = await client.userOnChat.create({
          data: {
            chat: {
              connect: {
                id: groupChatId,
              },
            },
            user: {
              connect: {
                id: nonMemberId,
              },
            },
          },
        });

        const res = await user2Req.member.delete.kickMember(
          groupChatId,
          nonMemberId,
          user2AccessToken
        );

        expect(res.status).toBe(204);

        const member = await client.userOnChat.findUnique({
          where: { id: kickedMember.id },
        });

        expect(member).toBeNull();
      });

      it("returns 204 (NO_CONTENT) when a member with a higher role and 'kick_member' permission kicks another member", async () => {
        const kickedMember = await client.userOnChat.create({
          data: {
            chat: {
              connect: {
                id: groupChatId,
              },
            },
            user: {
              connect: {
                id: nonMemberId,
              },
            },
          },
        });

        const res = await user4Req.member.delete.kickMember(
          groupChatId,
          nonMemberId,
          user4AccessToken
        );

        expect(res.status).toBe(204);

        const member = await client.userOnChat.findUnique({
          where: { id: kickedMember.id },
        });

        expect(member).toBeNull();
      });

      it("returns 204 (NO_CONTENT) when a member with a higher role and 'admin' permission kicks another member with 'admin' permission", async () => {
        const kickedMember = await client.userOnChat.create({
          data: {
            chat: {
              connect: {
                id: groupChatId,
              },
            },
            user: {
              connect: {
                id: nonMemberId,
              },
            },
            roles: {
              connect: { id: highestRoleLevelId },
            },
          },
        });

        const res = await user3Req.member.delete.kickMember(
          groupChatId,
          nonMemberId,
          user3AccessToken
        );

        expect(res.status).toBe(204);

        const member = await client.userOnChat.findUnique({
          where: { id: kickedMember.id },
        });

        expect(member).toBeNull();
      });
    });
  });
});

describe("Role creation", () => {
  beforeAll(async () => {
    const [highestRoleLevel, adminRole] = await client.$transaction([
      client.role.create({
        data: {
          name: "test_admin_role",
          roleLevel: 1,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "admin",
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_create_role",
          roleLevel: 2,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "manage_role",
            },
          },
        },
      }),
    ]);

    const memberWithAdminRole = await client.userOnChat.findFirst({
      where: { chat: { id: groupChatId }, user: { id: user2Id } },
      select: {
        id: true,
      },
    });

    const [roleManagerMember] = await client.$transaction([
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user3Id },
          },
          roles: { connect: { id: adminRole.id } },
        },
      }),
      client.userOnChat.update({
        where: {
          id: memberWithAdminRole.id,
        },
        data: {
          roles: {
            connect: {
              id: highestRoleLevel.id,
            },
          },
        },
      }),
    ]);

    return async () => {
      const memberIds = [roleManagerMember.id];

      const roleIds = [highestRoleLevel.id, adminRole.id];

      await client.$transaction([
        client.userOnChat.deleteMany({
          where: { id: { in: memberIds } },
        }),
        client.role.deleteMany({
          where: { id: { in: roleIds } },
        }),
      ]);
    };
  });

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          payload: { name: "test_role_name" },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          payload: { name: "test_role_name" },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          payload: { name: "test_role_name" },
          token: user2AccessToken,
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
        const { payload, token, includeAuth } = data;

        const res = await user1Req.role.post.createRole(
          groupChatId,
          payload,
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

  describe("Forbidden Errors", () => {
    it.each([
      {
        scenario: "non-member creating roles without permission",
        req: nonMemberReq,
        data: {
          payload: { name: "test_role" },
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to create chat roles",
        },
      },
    ])(
      "fails with 403 when $scenario",
      async ({ req, data, expectedError }) => {
        const { payload, token } = data;

        const res = await req.role.post.createRole(groupChatId, payload, token);

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Not Found Errors", () => {
    it.each([
      {
        scenario: "chat does not exist",
        data: {
          chatId: idGenerator(),
          payload: { name: "test_role_name" },
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "non-member creating private chat's role",
        data: {
          chatId: privateChatId,
          payload: { name: "test_role_name" },
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
      const { chatId, payload, token } = data;

      const res = await user1Req.role.post.createRole(chatId, payload, token);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject(expectedError);
    });
  });

  describe("Validation Errors", () => {
    it.each([
      {
        scenario: "chat ID invalid format",
        data: {
          chatId: "invalid_id_format",
          payload: {
            name: "test_created_role",
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "name invalid length",
        data: {
          payload: {
            name: Array.from({ length: 100 }, () => "foo").join(""),
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["name"], code: "too_big" },
      },
      {
        scenario: "name invalid type",
        data: {
          payload: {
            name: 42,
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["name"], code: "invalid_type" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await user1Req.role.post.createRole(
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
    it("returns 200 (OK) with the created role when the chat owner creates a role", async () => {
      const payload = { name: "created_role_by_owner" };

      const res = await user1Req.role.post.createRole(
        groupChatId,
        payload,
        user1AccessToken
      );

      const toMatchObject = {
        id: expect.any(String),
        name: expect.any(String),
        roleLevel: expect.any(Number),
        isDefaultRole: expect.any(Boolean),
        chatId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: null,
        permissions: expect.any(Array),
      };

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("pk");
      expect(res.body).toMatchObject(toMatchObject);
      expect(res.body.roleLevel).toBe(3);

      const role = await client.role.findUnique({ where: { id: res.body.id } });

      expect(role).not.toBeNull();
      expect(role.id).toBe(res.body.id);

      await client.role.delete({ where: { id: res.body.id } });
    });

    it("returns 200 (OK) with the created role when a member with 'manage_role' creates a role", async () => {
      const payload = { name: "created_role_with_manage_role_permission" };

      const res = await user3Req.role.post.createRole(
        groupChatId,
        payload,
        user3AccessToken
      );

      const toMatchObject = {
        id: expect.any(String),
        name: expect.any(String),
        roleLevel: expect.any(Number),
        isDefaultRole: expect.any(Boolean),
        chatId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: null,
        permissions: expect.any(Array),
      };

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("pk");
      expect(res.body).toMatchObject(toMatchObject);
      expect(res.body.roleLevel).toBe(3);

      const role = await client.role.findUnique({ where: { id: res.body.id } });

      expect(role).not.toBeNull();
      expect(role.id).toBe(res.body.id);

      await client.role.delete({ where: { id: res.body.id } });
    });
  });
});

describe("Role detail", () => {
  let highestRoleLevelId;

  beforeAll(async () => {
    const [highestRoleLevel, adminRole] = await client.$transaction([
      client.role.create({
        data: {
          name: "test_admin_role",
          roleLevel: 1,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "admin",
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_create_role",
          roleLevel: 2,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "manage_role",
            },
          },
        },
      }),
    ]);

    const memberWithAdminRole = await client.userOnChat.findFirst({
      where: { chat: { id: groupChatId }, user: { id: user2Id } },
      select: {
        id: true,
      },
    });

    const [roleManagerMember, normalMember] = await client.$transaction([
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user3Id },
          },
          roles: { connect: { id: adminRole.id } },
        },
      }),
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user4Id },
          },
        },
      }),

      client.userOnChat.update({
        where: {
          id: memberWithAdminRole.id,
        },
        data: {
          roles: {
            connect: {
              id: highestRoleLevel.id,
            },
          },
        },
      }),
    ]);

    highestRoleLevelId = highestRoleLevel.id;

    return async () => {
      const memberIds = [roleManagerMember.id, normalMember.id];

      const roleIds = [highestRoleLevel.id, adminRole.id];

      await client.$transaction([
        client.userOnChat.deleteMany({
          where: { id: { in: memberIds } },
        }),
        client.role.deleteMany({
          where: { id: { in: roleIds } },
        }),
      ]);
    };
  });

  describe("Role list", () => {
    describe("Authentication Errors", () => {
      it.each([
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
      ])(
        "fails with 401 (UNAUTHORIZED) for $scenario",
        async ({ data, expectedError }) => {
          const { token, includeAuth } = data;

          const res = await user1Req.role.get.roleList(groupChatId, token, {
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
          scenario: "non-member requesting to view the roles",
          req: nonMemberReq,
          data: {
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to view chat roles",
          },
        },
        {
          scenario:
            "member without the permission requesting to view the roles",
          req: user4Req,
          data: {
            token: user4AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "Missing permission: admin or manage_role",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { token } = data;

          const res = await req.role.get.roleList(groupChatId, token);

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "user requesting a private chat's roles",
          data: {
            chatId: privateChatId,
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, token } = data;

        const res = await user1Req.role.get.roleList(chatId, token);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user2AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await user1Req.role.get.roleList(
            chatId ?? groupChatId,
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
      it("returns 200 (OK) with all roles when the owner requests the chat's roles", async () => {
        const res = await user1Req.role.get.roleList(
          groupChatId,
          user1AccessToken
        );

        const toEqual = expect.arrayContaining([
          expect.objectContaining({
            name: "test_admin_role",
            roleLevel: 1,
          }),
          expect.objectContaining({
            name: "test_create_role",
            roleLevel: 2,
          }),
          expect.objectContaining({
            name: "everyone",
            roleLevel: null,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(toEqual);
      });

      it("returns 200 (OK) with all roles when a member with 'admin' permission requests the chat's roles", async () => {
        const res = await user2Req.role.get.roleList(
          groupChatId,
          user2AccessToken
        );

        const toEqual = expect.arrayContaining([
          expect.objectContaining({
            name: "test_admin_role",
            roleLevel: 1,
          }),
          expect.objectContaining({
            name: "test_create_role",
            roleLevel: 2,
          }),
          expect.objectContaining({
            name: "everyone",
            roleLevel: null,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(toEqual);
      });

      it("returns 200 (OK) with all roles when a member with 'manage_role' permission requests the chat's roles", async () => {
        const res = await user3Req.role.get.roleList(
          groupChatId,
          user3AccessToken
        );

        const toEqual = expect.arrayContaining([
          expect.objectContaining({
            name: "test_admin_role",
            roleLevel: 1,
          }),
          expect.objectContaining({
            name: "test_create_role",
            roleLevel: 2,
          }),
          expect.objectContaining({
            name: "everyone",
            roleLevel: null,
          }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(toEqual);
      });
    });
  });

  describe("Role by ID", () => {
    describe("Authentication Errors", () => {
      it.each([
        {
          scenario: "invalid token",
          data: {
            roleId: idGenerator(),
            token: user2InvalidToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            roleId: idGenerator(),
            token: user2ExpiredToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
            roleId: idGenerator(),
            token: user2AccessToken,
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
          const { roleId, token, includeAuth } = data;

          const res = await user1Req.role.get.roleById(
            groupChatId,
            roleId,
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

    describe("Forbidden Errors", () => {
      it.each([
        {
          scenario: "non-member requesting to view the roles",
          req: nonMemberReq,
          data: {
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to view chat roles",
          },
        },
        {
          scenario:
            "member without the permission requesting to view the roles",
          req: user4Req,
          data: {
            token: user4AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "Missing permission: admin or manage_role",
          },
        },
      ])(
        "fails with 403 when $scenario",
        async ({ req, data, expectedError }) => {
          const { token } = data;

          const res = await req.role.get.roleById(
            groupChatId,
            highestRoleLevelId,
            token
          );

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Not Found Errors", () => {
      it.each([
        {
          scenario: "chat does not exist",
          data: {
            chatId: idGenerator(),
            roleId: idGenerator(),
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "user requesting a private chat's role",
          data: {
            chatId: privateChatId,
            roleId: idGenerator(),
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "Role not found",
          data: {
            roleId: idGenerator(),
            token: user1AccessToken,
          },
          expectedError: { code: 404, message: "Role not found" },
        },
      ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
        const { chatId, roleId, token } = data;

        const res = await user1Req.role.get.roleById(
          chatId ?? groupChatId,
          roleId,
          token
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      });
    });

    describe("Validation Errors", () => {
      it.each([
        {
          scenario: "chat ID invalid format",
          data: {
            chatId: "invalid_id_format",
            token: user2AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "chat ID invalid format",
          data: {
            roleId: "invalid_id_format",
            token: user2AccessToken,
          },
          expectedError: { path: ["roleId"], code: "invalid_string" },
        },
      ])(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, roleId, token } = data;

          const res = await user1Req.role.get.roleById(
            chatId ?? groupChatId,
            roleId ?? highestRoleLevelId,
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
      it("returns 200 (OK) with the role when the chat owner requests a role", async () => {
        const res = await user1Req.role.get.roleById(
          groupChatId,
          highestRoleLevelId,
          user1AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          roleLevel: expect.any(Number),
          isDefaultRole: expect.any(Boolean),
          chatId: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: null,
          permissions: expect.any(Array),
        };

        const toEqualPermission = expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), name: "admin" }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("pk");
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.permissions).toEqual(toEqualPermission);
      });

      it("returns 200 (OK) with the role when a member with 'admin' permission requests a role", async () => {
        const res = await user2Req.role.get.roleById(
          groupChatId,
          highestRoleLevelId,
          user2AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          roleLevel: expect.any(Number),
          isDefaultRole: expect.any(Boolean),
          chatId: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: null,
          permissions: expect.any(Array),
        };

        const toEqualPermission = expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), name: "admin" }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("pk");
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.permissions).toEqual(toEqualPermission);
      });

      it("returns 200 (OK) with the role when a member with 'manage_role' permission requests a role", async () => {
        const res = await user2Req.role.get.roleById(
          groupChatId,
          highestRoleLevelId,
          user2AccessToken
        );

        const toMatchObject = {
          id: expect.any(String),
          name: expect.any(String),
          roleLevel: expect.any(Number),
          isDefaultRole: expect.any(Boolean),
          chatId: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: null,
          permissions: expect.any(Array),
        };

        const toEqualPermission = expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), name: "admin" }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("pk");
        expect(res.body).toMatchObject(toMatchObject);
        expect(res.body.permissions).toEqual(toEqualPermission);
      });
    });
  });
});

describe("Role update metadata", () => {
  let highestRoleLevelId;
  let adminRoleId;
  let roleManagerId;
  let lowestRoleId;
  let defaultRoleId;

  beforeAll(async () => {
    const [
      highestRoleLevel,
      noPermissionRole,
      adminRole,
      roleManager,
      lowestRole,
      defaultRole,
    ] = await client.$transaction([
      client.role.create({
        data: {
          name: "test_highest_role",
          roleLevel: 1,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "manage_role",
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_role_no_permission",
          roleLevel: 2,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_admin_role",
          roleLevel: 3,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "admin",
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_lowest_ranked_role",
          roleLevel: 4,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "manage_role",
            },
          },
        },
      }),
      client.role.create({
        data: {
          name: "test_lowest_role",
          roleLevel: 6,
          isDefaultRole: false,
          chat: {
            connect: {
              id: groupChatId,
            },
          },
          permissions: {
            connect: {
              name: "manage_role",
            },
          },
        },
      }),
      client.role.findFirst({
        where: {
          chat: { id: groupChatId },
          name: "everyone",
          isDefaultRole: true,
        },
      }),
    ]);

    const memberWithAdminRole = await client.userOnChat.findFirst({
      where: { chat: { id: groupChatId }, user: { id: user2Id } },
      select: {
        id: true,
      },
    });

    const [roleManagerMember] = await client.$transaction([
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user3Id },
          },
          roles: { connect: { id: adminRole.id } },
        },
      }),
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user4Id },
          },
          roles: { connect: { id: noPermissionRole.id } },
        },
      }),
      client.userOnChat.create({
        data: {
          chat: {
            connect: { id: groupChatId },
          },
          user: {
            connect: { id: user5Id },
          },
          roles: {
            connect: [{ id: roleManager.id }, { id: noPermissionRole.id }],
          },
        },
      }),
      client.userOnChat.update({
        where: {
          id: memberWithAdminRole.id,
        },
        data: {
          roles: {
            connect: {
              id: highestRoleLevel.id,
            },
          },
        },
      }),
    ]);

    highestRoleLevelId = highestRoleLevel.id;
    adminRoleId = adminRole.id;
    roleManagerId = roleManager.id;
    lowestRoleId = lowestRole.id;
    defaultRoleId = defaultRole.id;

    return async () => {
      const memberIds = [roleManagerMember.id];

      const roleIds = [highestRoleLevel.id, adminRole.id];

      await client.$transaction([
        client.userOnChat.deleteMany({
          where: { id: { in: memberIds } },
        }),
        client.role.deleteMany({
          where: { id: { in: roleIds } },
        }),
      ]);
    };
  });

  describe("Authentication Errors", () => {
    it.each([
      {
        scenario: "invalid token",
        data: {
          roleId: idGenerator(),
          payload: { name: "test_name" },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          roleId: idGenerator(),
          payload: { name: "test_name" },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          roleId: idGenerator(),
          payload: { name: "test_name" },
          token: user2AccessToken,
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
        const { roleId, payload, token, includeAuth } = data;

        const res = await user1Req.role.patch.metaData(
          groupChatId,
          roleId,
          payload,
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

  describe("Forbidden Errors", () => {
    const getRoleId = (scenario) => {
      if (
        scenario === "equal-ranked member updating permissions" ||
        scenario === "equal-ranked member updating role name"
      ) {
        return highestRoleLevelId;
      }

      if (scenario === "owner updating a default role name") {
        return defaultRoleId;
      }

      return adminRoleId;
    };

    it.each([
      {
        scenario: "non-member updating role",
        req: nonMemberReq,
        data: {
          payload: { name: "test_role" },
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to update roles",
        },
      },
      {
        scenario: "member without permissions updating role",
        req: user4Req,
        data: {
          payload: { name: "test_role" },
          token: user4AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Missing permission: admin or manage_role",
        },
      },
      {
        scenario: "owner updating a default role name",
        req: user1Req,
        data: {
          payload: { name: "test_role" },
          token: user1AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update the name of a default role",
        },
      },
      {
        scenario: "equal-ranked member updating role name",
        req: user2Req,
        data: {
          payload: { name: "test_role" },
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update name of a higher or equal role level",
        },
      },
      {
        scenario: "equal-ranked member updating permissions",
        req: user2Req,
        data: {
          payload: { permissionIds: [idGenerator()] },
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update permissions of a higher or equal role level",
        },
      },
      {
        scenario: "lower-ranked member updating higher role name",
        req: user5Req,
        data: {
          roleId: highestRoleLevelId,
          payload: { name: "test_role" },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update name of a higher or equal role level",
        },
      },
      {
        scenario:
          "higher-role lacks permission, lower-role has it — update name attempt",
        req: user5Req,
        data: {
          payload: { name: "test_role" },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update name of a higher or equal role level",
        },
      },
      {
        scenario: "lower-ranked member updating higher role permissions",
        req: user5Req,
        data: {
          roleId: highestRoleLevelId,
          payload: { permissionIds: [idGenerator()] },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update permissions of a higher or equal role level",
        },
      },
      {
        scenario:
          "higher-role lacks permission, lower-role has it — update permissions attempt",
        req: user5Req,
        data: {
          payload: { permissionIds: [idGenerator()] },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update permissions of a higher or equal role level",
        },
      },
    ])(
      "fails with 403 when $scenario",
      async ({ scenario, req, data, expectedError }) => {
        const { roleId, payload, token } = data;

        const res = await req.role.patch.metaData(
          groupChatId,
          roleId ?? getRoleId(scenario),
          payload,
          token
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Not Found Errors", () => {
    it.each([
      {
        scenario: "chat does not exist",
        data: {
          chatId: idGenerator(),
          payload: { name: "test_role_name" },
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "role does not exist",
        data: {
          roleId: idGenerator(),
          payload: { name: "test_role_name" },
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Role not found" },
      },
    ])("fails with 404 for $scenario", async ({ data, expectedError }) => {
      const { chatId, roleId, payload, token } = data;
      const res = await user1Req.role.patch.metaData(
        chatId ?? groupChatId,
        roleId ?? adminRoleId,
        payload,
        token
      );

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject(expectedError);
    });
  });

  describe("Validation Errors", () => {
    const duplicateId = idGenerator();

    it.each([
      {
        scenario: "chat ID invalid format",
        data: {
          chatId: "invalid_id_format",
          payload: {
            name: "test_created_role",
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "role ID invalid format",
        data: {
          chatId: idGenerator(),
          roleId: "invalid_id_format",
          payload: {
            name: "test_created_role",
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["roleId"], code: "invalid_string" },
      },
      {
        scenario: "name invalid type",
        data: {
          payload: {
            name: 42,
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["name"], code: "invalid_type" },
      },
      {
        scenario: "name invalid length",
        data: {
          payload: {
            name: Array.from({ length: 100 }, () => "foo").join(""),
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["name"], code: "too_big" },
      },
      {
        scenario: "permission ID at index 0 has an invalid string",
        data: {
          payload: {
            permissionIds: ["invalid_id_format", idGenerator()],
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["permissionIds", 0], code: "invalid_string" },
      },
      {
        scenario: "duplicate permission ID in the array",

        data: {
          payload: {
            permissionIds: [duplicateId, duplicateId, idGenerator()],
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["permissionIds"], code: "custom" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, payload, token } = data;

        const res = await user1Req.role.patch.metaData(
          chatId ?? groupChatId,
          roleId ?? adminRoleId,
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

  describe("Update name", () => {
    beforeEach(async () => {
      client.$transaction([
        client.role.update({
          where: {
            id: adminRoleId,
          },
          data: {
            name: "test_admin_role",
          },
        }),
        client.role.update({
          where: {
            id: lowestRoleId,
          },
          data: {
            name: "test_lowest_role",
          },
        }),
      ]);
    });

    describe("Success case", () => {
      it("returns 204 (NO_CONTENT) when the chat owner updates an admin role", async () => {
        const payload = { name: "updated_name_by_owner" };

        const res = await user1Req.role.patch.metaData(
          groupChatId,
          adminRoleId,
          payload,
          user1AccessToken
        );

        expect(res.status).toBe(204);

        const updatedRole = await client.role.findUnique({
          where: { id: adminRoleId },
        });

        expect(updatedRole.name).toMatch(payload.name);
        expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      });

      it("returns 204 (NO_CONTENT) when a member with the highest role and proper permission updates an admin role", async () => {
        const payload = { name: "updated_name_by_higher_ranked_member" };

        const res = await user2Req.role.patch.metaData(
          groupChatId,
          adminRoleId,
          payload,
          user2AccessToken
        );

        expect(res.status).toBe(204);

        const updatedRole = await client.role.findUnique({
          where: { id: adminRoleId },
        });

        expect(updatedRole.name).toMatch(payload.name);
        expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      });

      it("returns 204 (NO_CONTENT) when a member with the higher role and proper permission updates an lower role", async () => {
        const payload = {
          name: "updated_name_by_member_with_manage_role_perm",
        };

        const res = await user5Req.role.patch.metaData(
          groupChatId,
          lowestRoleId,
          payload,
          user5AccessToken
        );

        expect(res.status).toBe(204);

        const updatedRole = await client.role.findUnique({
          where: { id: lowestRoleId },
        });

        expect(updatedRole.name).toMatch(payload.name);
        expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      });
    });
  });

  describe("Update permissions", () => {
    beforeEach(async () => {
      await client.role.update({
        where: {
          id: adminRoleId,
        },
        data: {
          permissions: {
            set: [],
            connect: { name: "admin" },
          },
        },
      });
    });

    it("returns 204 (NO_CONTENT) when the chat owner updates an admin role", async () => {
      const permissions = await client.permission.findMany({
        where: {
          name: { in: ["kick_member", "manage_role"] },
        },
        select: { id: true, name: true },
      });

      const payload = { permissionIds: permissions.map(({ id }) => id) };

      const res = await user1Req.role.patch.metaData(
        groupChatId,
        adminRoleId,
        payload,
        user1AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: adminRoleId },
        select: {
          permissions: {
            select: {
              name: true,
            },
          },
        },
      });

      const expectedRoleUpdatedPermissions = expect.arrayContaining([
        expect.objectContaining({
          name: "kick_member",
        }),
        expect.objectContaining({
          name: "manage_role",
        }),
      ]);

      expect(updatedRole.permissions).toHaveLength(2);
      expect(updatedRole.permissions).toEqual(expectedRoleUpdatedPermissions);
      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
    });

    it("returns 204 (NO_CONTENT) when a member with the highest role and proper permission updates an admin role", async () => {
      const permissions = await client.permission.findMany({
        where: {
          name: { in: ["kick_member", "manage_role", "send_message"] },
        },
        select: { id: true, name: true },
      });

      const payload = { permissionIds: permissions.map(({ id }) => id) };

      const res = await user2Req.role.patch.metaData(
        groupChatId,
        adminRoleId,
        payload,
        user2AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: adminRoleId },
        select: {
          permissions: {
            select: {
              name: true,
            },
          },
        },
      });

      const expectedRoleUpdatedPermissions = expect.arrayContaining([
        expect.objectContaining({
          name: "kick_member",
          name: "send_message",
        }),
        expect.objectContaining({
          name: "manage_role",
        }),
        expect.objectContaining({
          name: "send_message",
        }),
      ]);

      expect(updatedRole.permissions).toHaveLength(3);
      expect(updatedRole.permissions).toEqual(expectedRoleUpdatedPermissions);
      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
    });

    it("returns 204 (NO_CONTENT) when a member with the higher role and proper permission updates an lower role", async () => {
      const permissions = await client.permission.findMany({
        where: {
          name: { in: ["admin"] },
        },
        select: { id: true, name: true },
      });

      const payload = { permissionIds: permissions.map(({ id }) => id) };

      const res = await user5Req.role.patch.metaData(
        groupChatId,
        lowestRoleId,
        payload,
        user5AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: lowestRoleId },
        select: {
          permissions: {
            select: {
              name: true,
            },
          },
        },
      });

      const expectedRoleUpdatedPermissions = expect.arrayContaining([
        expect.objectContaining({
          name: "admin",
        }),
      ]);

      expect(updatedRole.permissions).toHaveLength(1);
      expect(updatedRole.permissions).toEqual(expectedRoleUpdatedPermissions);
      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
    });
  });
});

describe("Role relations", () => {
  describe.skip("Update members", () => {});
});

describe("Role hierarchy", () => {
  describe.skip("Update role levels", () => {});
});
