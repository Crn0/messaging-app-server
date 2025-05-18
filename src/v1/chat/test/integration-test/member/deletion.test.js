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
  ids: { user1Id, user2Id, user3Id, user4Id, user5Id, user6Id: nonMemberId },
  accessTokens: {
    user1AccessToken,
    user2AccessToken,
    user3AccessToken,
    user4AccessToken,
    user6AccessToken: nonMemberAccessToken,
  },
} = await setupTestUsers(6);

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

describe("Member deletion", () => {
  describe("Member leaving", () => {
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
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await request.member.delete.leaveChat(
            chatId ?? groupChatId,
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

          const res = await request.member.delete.leaveChat(
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
      const scenarios = [
        {
          scenario: "non-member tries to leave chat",
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
          data: {
            token: user1AccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "Must transfer chat ownership before you can leave",
          },
        },
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await request.member.delete.leaveChat(
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

        const res = await request.member.delete.leaveChat(
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
    let adminRoleId;

    beforeAll(async () => {
      await request.member.post.joinMember(groupChatId, user2AccessToken);

      const [adminRole, highestRole, kickRole] = await client.$transaction([
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
                  id: adminRole.id,
                },
              },
            },
          }),
        ]);

      adminRoleId = adminRole.id;

      return async () => {
        const memberIds = [
          memberWithKickRole1.id,
          memberWithKickRole2.id,
          memberWithHighestRole.id,
        ];

        const roleIds = [highestRole.id, highestRole.id, kickRole.id];

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
      const scenarios = [
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
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await request.member.delete.kickMember(
            chatId ?? groupChatId,
            memberId,
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
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await request.member.delete.kickMember(
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
      const scenarios = [
        {
          scenario: "non-member tries to kick a member",
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
      ];

      it.each(scenarios)(
        "fails with 403 when $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, token } = data;

          const res = await request.member.delete.kickMember(
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

        const res = await request.member.delete.kickMember(
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

        const res = await request.member.delete.kickMember(
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
              connect: { id: adminRoleId },
            },
          },
        });

        const res = await request.member.delete.kickMember(
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
