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
  invalidTokens: { user1InvalidToken },
  expiredTokens: { user1ExpiredToken },
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

describe("Member update", () => {
  describe("Muted until", () => {
    let muteRoleId;
    let normalMember1Id;

    beforeAll(async () => {
      await request.member.post.joinMember(groupChatId, user2AccessToken);

      const defaultRole = await client.role.findFirst({
        where: { isDefaultRole: true, chat: { id: groupChatId } },
      });

      const [adminRole, highestRole, muteRole] = await client.$transaction([
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
                  id: adminRole.id,
                },
              },
            },
          }),
        ]);

      muteRoleId = muteRole.id;
      normalMember1Id = normalMember1.id;

      return async () => {
        const memberIds = [
          normalMember1.id,
          normalMember2.id,
          memberWithHighestRole.id,
        ];

        const roleIds = [adminRole.id, highestRole.id, muteRole.id];

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

    const notFoundScenarios = [
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
    ];

    describe("Not Found Errors", () => {
      it.each(notFoundScenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, payload, token } = data;

          const res = await request.member.patch.mutedUntil(
            chatId ?? groupChatId,
            memberId,
            payload,
            token
          );

          expect(res.status).toBe(404);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    const validationErrorScenarios = [
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
    ];

    describe("Validation Errors", () => {
      it.each(validationErrorScenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, memberId, payload, token } = data;

          const res = await request.member.patch.mutedUntil(
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

    const forbiddenMuteScenarios = [
      {
        scenario: "a non-member tries to mute a chat member",
        data: {
          memberId: user2Id,
          token: nonMemberAccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to mute others",
        },
      },
      {
        scenario: "member role without permission attempts to mute user",
        data: {
          memberId: user4Id,
          token: user4AccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "Missing permission: admin or mute_member",
        },
      },
      {
        scenario:
          "member role with permission equal to target user role level attempts to mute user",
        data: {
          memberId: user3Id,
          token: user3AccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "You cannot mute a member with higher or equal role level",
        },
      },
      {
        scenario: "a owner trying to mute a user that has admin permission",
        data: {
          memberId: user2Id,
          token: user1AccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "You cannot mute an admin member",
        },
      },
      {
        scenario: "a user trying to mute the chat owner",
        data: {
          memberId: user1Id,
          token: user2AccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "You cannot mute the chat owner",
        },
      },
      {
        scenario: "a user trying to mute a higher ranked member",
        data: {
          memberId: user3Id,
          token: user2AccessToken,
          includeAuth: true,
          payload: { mutedUntil: new Date(Date.now() + 71 * 1000) },
        },
        expectedError: {
          code: 403,
          message: "You cannot mute a member with higher role level",
        },
      },
    ];

    describe("Mute member", () => {
      const validForm = { mutedUntil: new Date(Date.now() + 71 * 1000) };

      describe("Forbidden Errors", () => {
        it.each(forbiddenMuteScenarios)(
          "fails with 403 when $scenario",
          async ({ data, expectedError }) => {
            const { chatId, memberId, payload, token } = data;

            const res = await request.member.patch.mutedUntil(
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
          const res = await request.member.patch.mutedUntil(
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
          const res = await request.member.patch.mutedUntil(
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
          const res = await request.member.patch.mutedUntil(
            groupChatId,
            user5Id,
            validForm,
            user4AccessToken
          );
          expect(res.status).toBe(204);
        });
      });
    });
  });
});
