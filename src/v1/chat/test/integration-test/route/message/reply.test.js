import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../../db/client.js";
import app from "../../../utils/server.js";
import Storage from "../../../../../storage/index.js";
import attachment from "../../../data/file-upload.js";
import { env } from "../../../../../../constants/index.js";
import {
  baseRequest,
  userFactory,
  setupTestUsers as initSetupUsers,
} from "../../../utils/index.js";
import { idGenerator } from "../../../../utils.js";

const { TEST_UPLOAD } = env;

const request = baseRequest({ request: req(app), url: "/api/v1" });

const storage = Storage();
const User = userFactory();
const setupTestUsers = initSetupUsers(User);

const {
  users,
  entities,
  ids: { user1Id, user2Id, user3Id, user4Id, user5Id },
  accessTokens: {
    user1AccessToken,
    user2AccessToken,
    user3AccessToken: mutedMemberAccessToken,
    user4AccessToken: noMessagePermAccessToken,
    user5AccessToken: nonMemberAccessToken,
  },
  expiredTokens: { user2ExpiredToken },
  invalidTokens: { user2InvalidToken },
} = await setupTestUsers(5);

let groupChatId;
let directChatId;
let blockedChatId;

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

  const blockedChatPayload = {
    chatId: blockedChatId,
    type: "DirectChat",
    memberIds: [user3Id, user5Id],
  };

  await client.$transaction([
    ...entities.map((entity) => client.user.create({ data: { ...entity } })),
  ]);

  const [groupChatResult, directChatResult, blockChatResult] =
    await Promise.all([
      request.chat.post.chat(user1AccessToken, groupChatPayload),
      request.chat.post.chat(user1AccessToken, directChatPayload),
      request.chat.post.chat(mutedMemberAccessToken, blockedChatPayload),
    ]);

  groupChatId = groupChatResult.body.id;
  directChatId = directChatResult.body.id;
  blockedChatId = blockChatResult.body.id;

  await Promise.all([
    request.member.post.joinMember(groupChatResult.body.id, user2AccessToken),
    request.member.post.joinMember(
      groupChatResult.body.id,
      mutedMemberAccessToken
    ),
    client.userOnChat.create({
      data: {
        chat: { connect: { id: groupChatId } },
        user: { connect: { id: user4Id } },
      },
    }),
  ]);

  const [roleResult] = await Promise.all([
    request.role.post.createRole(
      groupChatId,
      {
        name: "admin_role",
      },
      user1AccessToken
    ),
    client.user.update({
      where: { id: user3Id },
      data: { blockedUsers: { connect: { id: user5Id } } },
    }),
  ]);

  const roleId = roleResult.body.id;

  await Promise.all([
    request.role.patch.members(
      groupChatId,
      roleId,
      {
        memberIds: [user2Id],
      },
      user1AccessToken
    ),
    request.role.patch.metaData(
      groupChatId,
      roleId,
      { permissions: ["admin"] },
      user1AccessToken
    ),
    request.member.patch.mutedUntil(
      groupChatId,
      user3Id,
      {
        mutedUntil: new Date(Date.now() + 1 * 60 * 60 * 1000),
      },
      user1AccessToken
    ),
  ]);

  return async () => {
    const chatIds = [directChatId, groupChatId, blockedChatId].filter(Boolean);

    if (TEST_UPLOAD) {
      const messageAttachmentPaths = chatIds.map(
        (id) => `${process.env.CLOUDINARY_ROOT_NAME}/messages/${id}`
      );

      await Promise.allSettled(
        messageAttachmentPaths.map(async (id) => storage.destroyFolder(id))
      );
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

describe("Message reply", () => {
  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          chatId: idGenerator(),
          messageId: idGenerator(),
          payload: { content: "test_message" },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          chatId: idGenerator(),
          messageId: idGenerator(),
          payload: { content: "test_message" },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          chatId: idGenerator(),
          messageId: idGenerator(),
          payload: { content: "test_message" },
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
        const { chatId, messageId, payload, token, includeAuth } = data;

        const res = await request.message.post.sendReply(
          chatId,
          messageId,
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
    const getId = (type) => {
      if (type === "DirectChat") return blockedChatId;

      return groupChatId;
    };

    const scenarios = [
      {
        scenario: "non-member sends a message to a public group chat",
        data: {
          messageId: idGenerator(),
          payload: { content: "test_message" },
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to send messages",
        },
      },
      {
        scenario: "muted member sends a message",
        data: {
          messageId: idGenerator(),
          payload: { name: "test_message" },
          token: mutedMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot perform this action while muted",
        },
      },
      {
        scenario: "member without permission sends a message",
        data: {
          messageId: idGenerator(),
          payload: { name: "test_message" },
          token: noMessagePermAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "Missing permission: admin or send_message or manage_message",
        },
      },
      {
        scenario: "user sends a message to someone who blocked them",
        data: {
          type: "DirectChat",
          messageId: idGenerator(),
          payload: { name: "test_message" },
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Either user has blocked the other",
        },
      },
      {
        scenario: "user sends a direct message to a blocked user",
        data: {
          type: "DirectChat",
          messageId: idGenerator(),
          payload: { name: "test_message" },
          token: mutedMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Either user has blocked the other",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ data, expectedError }) => {
        const { type, messageId, payload, token } = data;

        const chatId = data?.chatId ?? getId(type);

        const res = await request.message.post.sendReply(
          chatId,
          messageId,
          payload,
          token
        );

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Not Found Errors", () => {
    const getId = (type) => {
      if (type === "DirectChat") return directChatId;

      return groupChatId;
    };

    const scenarios = [
      {
        scenario: "chat does not exist",
        data: {
          chatId: idGenerator(),
          messageId: idGenerator(),
          token: user1AccessToken,
          payload: { content: "test_message" },
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "message does not exist",
        data: {
          messageId: idGenerator(),
          token: user1AccessToken,
          payload: { content: "test_message" },
        },
        expectedError: { code: 404, message: "Message not found" },
      },
      {
        scenario: "user sends a message to a private chat",
        data: {
          type: "DirectChat",
          messageId: idGenerator(),
          token: nonMemberAccessToken,
          payload: { content: "test_message" },
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { type, messageId, payload, token } = data;

        const chatId = data?.chatId || getId(type);

        const res = await request.message.post.sendReply(
          chatId,
          messageId,
          payload,
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
          messageId: idGenerator(),
          token: user1AccessToken,
          payload: {
            content: "test_message",
          },
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "message ID invalid format",
        data: {
          chatId: idGenerator(),
          messageId: "invalid_id_format",
          token: user1AccessToken,
          payload: {
            content: "test_message",
          },
        },
        expectedError: { path: ["messageId"], code: "invalid_string" },
      },
      {
        scenario: "attachment with unsupported mimetype",
        data: {
          messageId: idGenerator(),
          token: user1AccessToken,
          payload: {
            content: "test_message",
            attachments: [
              attachment.avatar,
              attachment.backgroundAvatar,
              attachment.catGif,
            ],
          },
        },
        expectedError: { path: ["attachments", 2, "mimetype"], code: "custom" },
      },
      {
        scenario: "attachments array length exceeds allowed maximum of 5",
        data: {
          token: user1AccessToken,
          payload: {
            content: "test_message",
            attachments: [
              attachment.avatar,
              attachment.backgroundAvatar,
              attachment.backgroundAvatar,
              attachment.backgroundAvatar,
              attachment.backgroundAvatar,
              attachment.backgroundAvatar,
            ],
          },
        },
        expectedError: { path: ["attachments"], code: "custom" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { messageId, payload, token } = data;

        const chatId = data?.chatId ?? groupChatId;

        const res = await request.message.post.sendReply(
          chatId,
          messageId,
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
    const getId = (type) => {
      if (type === "DirectChat") return directChatId;

      return groupChatId;
    };

    describe("Message with content", () => {
      const scenarios = [
        {
          scenario: "user sends a reply to a message in a direct chat",
          data: {
            type: "DirectChat",

            userId: user2Id,
            token: user2AccessToken,
            replyToToken: user1AccessToken,
            payload: { content: "test_message" },
          },
        },
        {
          scenario: "user sends a reply to a message in a group chat",
          data: {
            type: "GroupChat",

            userId: user1Id,
            token: user1AccessToken,
            replyToToken: user2AccessToken,
            payload: { content: "test_message" },
          },
        },
      ];

      it.each(scenarios)(
        "returns 200 (OK) with the created message when $scenario",
        async ({ data }) => {
          const { type, userId, payload, token, replyToToken } = data;

          const chatId = getId(type);

          const message = await request.message.post.createMessage(
            chatId,
            { name: "test_message" },
            replyToToken
          );

          const messageId = message.body.id;

          const res = await request.message.post.sendReply(
            chatId,
            messageId,
            payload,
            token
          );

          const expectedReply = {
            chatId,
            id: expect.any(String),
            content: payload.content,
            createdAt: expect.any(String),
            updatedAt: null,
            user: {
              id: userId,
              profile: { avatar: null },
            },
            deletedAt: null,
            replies: expect.any(Array),
            replyTo: expect.any(Object),
            attachments: expect.any(Array),
          };

          expect(res.status).toBe(200);
          expect(res.body).toMatchObject(expectedReply);
          expect(new Date(res.body.createdAt).toString()).not.toBe(
            "Invalid Date"
          );
          expect(res.body.updatedAt).toBeNull();
          expect(res.body.deletedAt).toBeNull();

          const parent = await client.message.findUnique({
            where: { id: messageId },
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              chat: { select: { id: true } },
              user: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      avatar: {
                        include: {
                          images: {
                            select: { url: true, format: true, size: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
              replies: { select: { id: true } },
            },
          });

          const expectedReplyTo = {
            id: parent.id,
          };

          expect(res.body.replyTo).toMatchObject(expectedReplyTo);
          expect(
            parent.replies.some((reply) => reply.id === res.body.id)
          ).toBeTruthy();
        }
      );
    });

    describe.skipIf(TEST_UPLOAD === false)(
      "Message with content and attachments",
      () => {
        const scenarios = [
          {
            scenario: "user sends a message to a direct chat",
            data: {
              type: "DirectChat",
              userId: user2Id,
              token: user2AccessToken,
              replyToToken: user1AccessToken,
              payload: {
                content: "test_message",
                attachments: [attachment.avatar, attachment.backgroundAvatar],
              },
            },
          },
          {
            scenario: "user sends a message to a group chat",
            data: {
              type: "GroupChat",
              userId: user1Id,
              token: user1AccessToken,
              replyToToken: user2AccessToken,
              payload: {
                content: "test_message",
                attachments: [attachment.avatar, attachment.backgroundAvatar],
              },
            },
          },
        ];

        it.each(scenarios)(
          "returns 200 (OK) with the created message when $scenario",
          async ({ data }) => {
            const { type, userId, payload, token, replyToToken } = data;

            const chatId = getId(type);

            const message = await request.message.post.createMessage(
              chatId,
              { name: "test_message" },
              replyToToken
            );

            const messageId = message.body.id;

            const res = await request.message.post.sendReply(
              chatId,
              messageId,
              payload,
              token
            );

            const expectCreatedMessage = {
              chatId,
              id: expect.any(String),
              content: payload.content,
              createdAt: expect.any(String),
              updatedAt: null,
              user: {
                id: userId,
                profile: { avatar: null },
              },
              deletedAt: null,
              replies: expect.any(Array),
              attachments: expect.any(Array),
            };

            const expectedImage = expect.objectContaining({
              url: expect.any(String),
              format: "webp",
              size: expect.any(Number),
            });

            const expectedAttachment = expect.objectContaining({
              name: expect.any(String),
              url: expect.any(String),
              size: expect.any(Number),
              createdAt: expect.any(String),
              updatedAt: null,
              images: expect.arrayContaining([
                expectedImage,
                expectedImage,
                expectedImage,
              ]),
            });

            const expectedAttachments = expect.arrayContaining([
              expectedAttachment,
              expectedAttachment,
            ]);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject(expectCreatedMessage);
            expect(res.body.attachments).toEqual(expectedAttachments);
            expect(new Date(res.body.createdAt).toString()).not.toBe(
              "Invalid Date"
            );
            expect(res.body.updatedAt).toBeNull();
            expect(res.body.deletedAt).toBeNull();

            const parent = await client.message.findUnique({
              where: { id: messageId },
              select: {
                id: true,
                content: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                chat: { select: { id: true } },
                user: {
                  select: {
                    id: true,
                    profile: {
                      select: {
                        avatar: {
                          include: {
                            images: {
                              select: { url: true, format: true, size: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                replies: { select: { id: true } },
              },
            });

            const expectedReplyTo = {
              id: parent.id,
            };

            expect(res.body.replyTo).toMatchObject(expectedReplyTo);
            expect(
              parent.replies.some((reply) => reply.id === res.body.id)
            ).toBeTruthy();
          }
        );
      }
    );
  });
});
