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
  ids: { user1Id, user2Id, user3Id },
  accessTokens: { user1AccessToken, user2AccessToken },
  invalidTokens: { user1InvalidToken },
  expiredTokens: { user1ExpiredToken },
} = await setupTestUsers(3);

let groupChatId;
let directChatId;

beforeAll(async () => {
  await client.$transaction([
    ...entities.map((entity) => client.user.create({ data: { ...entity } })),
  ]);

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

describe("Chat creation", () => {
  const diretChatForm = {
    type: "DirectChat",
    memberIds: [user1Id, user2Id],
  };

  const groupChatForm = {
    name: "test_group_chat",
    type: "GroupChat",
  };

  const groupChatWithAvatarForm = {
    name: "test_group_chat_with_avatar",
    avatar: attachment.avatar,
    type: "GroupChat",
  };

  describe("Authentication Errors", () => {
    const scenarios = [
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
    ];

    it.each(scenarios)(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { token, payload, includeAuth } = data;

        const res = await request.chat.post.chat(token, payload, {
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
      const scenarios = [
        {
          scenario: "creating a direct message to a blocked user",
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
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { payload, token } = data;

          const res = await request.chat.post.chat(token, payload);

          expect(res.status).toBe(403);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Validation Errors", () => {
      const scenarios = [
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
          scenario: "members ID too small",
          data: {
            token: user1AccessToken,
            payload: {
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
              type: "DirectChat",
            },
          },
          expectedError: { path: ["memberIds"], code: "invalid_type" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { token, payload } = data;

          const res = await request.chat.post.chat(token, payload);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) and the chat object", async () => {
        const res = await request.chat.post.chat(
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

        directChatId = res.body.id;

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
          }),
          expect.objectContaining({
            roles: [{ name: "everyone" }],
          }),
        ]);

        expect(members).toEqual(toEqualMembers);
      });

      it("returns 200 (OK) when there is existing direct chat between users", async () => {
        const res = await request.chat.post.chat(
          user1AccessToken,
          diretChatForm
        );

        const toMatchObject = {
          id: directChatId,
          name: null,
          avatar: null,
          isPrivate: expect.any(Boolean),
          createdAt: expect.any(String),
          updatedAt: null,
          type: expect.any(String),
        };

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(toMatchObject);
      });
    });
  });

  describe("Group chat", () => {
    describe("Validation Errors", () => {
      const scenarios = [
        {
          scenario: "invalid chat type",
          payload: {
            type: "invalidType",
          },
          expectedError: { path: ["type"], code: "invalid_enum_value" },
        },
        {
          scenario: "name is over 100 characters",
          payload: {
            name: Array.from({ length: 100 }, () => "foo").join(""),
            type: "GroupChat",
          },
          expectedError: { path: ["name"], code: "too_big" },
        },
        {
          scenario: "avatar invalid mimetype",
          payload: {
            name: "test",
            avatar: attachment.catGif,
            type: "GroupChat",
          },
          expectedError: { path: ["avatar", "mimetype"], code: "custom" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ payload, expectedError }) => {
          const res = await request.chat.post.chat(user1AccessToken, payload);

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    describe("Success case", () => {
      it("returns 200 (OK) and the chat object", async () => {
        const res = await request.chat.post.chat(
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
            chat: { id: res.body.id },
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
          }),
        ]);

        expect(members).toEqual(toEqualMembers);
      });

      it.skipIf(TEST_UPLOAD === false)(
        "creates a chat with avatar and returns the chat object",
        async () => {
          const res = await request.chat.post.chat(
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
