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
  ids: { user1Id, user2Id, user3Id },
  accessTokens: {
    user1AccessToken,
    user2AccessToken,
    user3AccessToken,
    user4AccessToken,
    user5AccessToken,
    user6AccessToken: nonMemberAccessToken,
  },
  expiredTokens: { user2ExpiredToken },
  invalidTokens: { user2InvalidToken },
} = await setupTestUsers(6);

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

  await Promise.all([
    request.member.post.joinMember(groupChatId, user2AccessToken),
    request.member.post.joinMember(groupChatId, user3AccessToken),
    request.member.post.joinMember(groupChatId, user4AccessToken),
    request.member.post.joinMember(groupChatId, user5AccessToken),
  ]);

  const [adminRoleRes, messageManagerRoleRes] = await Promise.all([
    request.role.post.createRole(
      groupChatId,
      { name: "test_admin_role" },
      user1AccessToken
    ),
    request.role.post.createRole(
      groupChatId,
      { name: "test_message_manager_role" },
      user1AccessToken
    ),
  ]);

  await Promise.all([
    request.role.patch.members(
      groupChatId,
      adminRoleRes.body.id,
      { memberIds: [user2Id] },
      user1AccessToken
    ),
    request.role.patch.members(
      groupChatId,
      messageManagerRoleRes.body.id,

      { memberIds: [user3Id] },
      user1AccessToken
    ),
    request.role.patch.metaData(
      groupChatId,
      adminRoleRes.body.id,
      { permissions: ["admin"] },
      user1AccessToken
    ),
    request.role.patch.metaData(
      groupChatId,
      messageManagerRoleRes.body.id,
      { permissions: ["manage_message"] },
      user1AccessToken
    ),
  ]);

  return async () => {
    const chatIds = [directChatId, groupChatId].filter(Boolean);

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

describe("Message deletion", () => {
  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          chatId: idGenerator(),
          messageId: idGenerator(),
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
          messageId: idGenerator(),
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
        const { chatId, messageId, token, includeAuth } = data;

        const res = await request.message.delete.message(
          chatId,
          messageId,
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
    let messageId;

    beforeAll(async () => {
      const res = await request.message.post.createMessage(
        groupChatId,
        {
          content: `test_message`,
        },
        user1AccessToken
      );

      messageId = res.body.id;

      return async () => client.message.delete({ where: { id: messageId } });
    });

    const scenarios = [
      {
        scenario: "non-member delete a message to a public group chat",
        data: {
          messageId: idGenerator(),
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to delete messages",
        },
      },
      {
        scenario: "member without permission delete another user's message",
        data: {
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Missing permission: admin or manage_message",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ data, expectedError }) => {
        const { token } = data;
        const chatId = data?.chatId ?? groupChatId;

        const res = await request.message.delete.message(
          chatId,
          data?.messageId ?? messageId,
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
        },
        expectedError: { code: 404, message: "Message not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { messageId, token } = data;
        const chatId = data?.chatId ?? groupChatId;

        const res = await request.message.delete.message(
          chatId,
          messageId,
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
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "message ID invalid format",
        data: {
          chatId: idGenerator(),
          messageId: "invalid_id_format",
          token: user1AccessToken,
        },
        expectedError: { path: ["messageId"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { messageId, token } = data;

        const chatId = data?.chatId ?? groupChatId;

        const res = await request.message.delete.message(
          chatId,
          messageId,
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
    describe("Message with content", () => {
      beforeAll(async () => {
        await Promise.all(
          Array.from({ length: 5 }).map(async (_, i) =>
            request.message.post.createMessage(
              groupChatId,
              {
                content: `test_message${i}`,
              },
              user5AccessToken
            )
          )
        );
      });

      const scenarios = [
        {
          scenario: "the chat owner deletes the message",
          data: {
            token: user1AccessToken,
          },
        },
        {
          scenario: "a member with admin permission deletes the message",
          data: {
            token: user2AccessToken,
          },
        },
        {
          scenario:
            "a member with manage_message permission deletes the message",
          data: {
            token: user3AccessToken,
          },
        },
        {
          scenario: "the message author deletes the message",
          data: {
            token: user5AccessToken,
          },
        },
      ];

      it.each(scenarios)("returns 204 when $scenario", async ({ data }) => {
        const { token } = data;

        const message = await client.message.findFirst({
          where: { chat: { id: groupChatId } },
          select: { id: true },
        });

        const res = await request.message.delete.message(
          groupChatId,
          message.id,
          token
        );

        expect(res.status).toBe(204);

        const deletedMessage = await client.message.findUnique({
          where: { id: message.id },
          select: { id: true },
        });

        expect(deletedMessage).toBeNull();
      });
    });

    describe.skipIf(TEST_UPLOAD === false)(
      "Message with content and attachments",
      () => {
        beforeAll(async () => {
          await Promise.all(
            Array.from({ length: 4 }).map(async (_, i) =>
              request.message.post.createMessage(
                groupChatId,
                {
                  content: `test_message${i}`,
                  attachments: [attachment.avatar],
                },
                user5AccessToken
              )
            )
          );
        });

        const scenarios = [
          {
            scenario: "the chat owner deletes the message",
            data: {
              token: user1AccessToken,
            },
          },
          {
            scenario: "a member with admin permission deletes the message",
            data: {
              token: user2AccessToken,
            },
          },
          {
            scenario:
              "a member with manage_message permission deletes the message",
            data: {
              token: user3AccessToken,
            },
          },
          {
            scenario: "the message author deletes the message",
            data: {
              token: user5AccessToken,
            },
          },
        ];

        it.each(scenarios)("returns 204 when $scenario", async ({ data }) => {
          const { token } = data;

          const message = await client.message.findFirst({
            where: { chat: { id: groupChatId } },
            select: { id: true, attachments: { select: { id: true } } },
          });

          const res = await request.message.delete.message(
            groupChatId,
            message.id,
            token
          );

          expect(res.status).toBe(204);

          const deletedMessage = await client.message.findUnique({
            where: { id: message.id },
            select: { id: true },
          });

          expect(deletedMessage).toBeNull();

          const fileResults = await Promise.allSettled(
            message.attachments.map(({ id }) => storage.getFile(id))
          );

          fileResults.forEach((result) => {
            expect(result.status).toBe("rejected");
          });
        });
      }
    );
  });
});
