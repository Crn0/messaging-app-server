import req from "supertest";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
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
    user5AccessToken,
    user6AccessToken: nonMemberAccessToken,
  },
  expiredTokens: { user2ExpiredToken },
  invalidTokens: { user2InvalidToken },
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

  await Promise.all([
    request.member.post.joinMember(groupChatResult.body.id, user2AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user3AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user4AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user5AccessToken),
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

describe("Add members", () => {
  let highestRoleLevelId;
  let adminRoleId;
  let roleManagerId;
  let lowestRoleId;
  let defaultRoleId;
  const validForm = { memberIds: [nonMemberId] };

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
          roleLevel: 5,
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

    const [
      memberWithHighestRole,
      memberWithAdminRole,
      memberWithRoleButNoPerm,
      memberWithRoleManagePerm,
    ] = await client.$transaction([
      client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user2Id } },
        select: {
          id: true,
        },
      }),
      client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user3Id } },
        select: {
          id: true,
        },
      }),
      client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user4Id } },
        select: {
          id: true,
        },
      }),
      client.userOnChat.findFirst({
        where: { chat: { id: groupChatId }, user: { id: user5Id } },
        select: {
          id: true,
        },
      }),
    ]);

    await client.$transaction([
      client.userOnChat.update({
        where: { id: memberWithAdminRole.id },
        data: {
          roles: { connect: { id: adminRole.id } },
        },
      }),
      client.userOnChat.update({
        where: { id: memberWithRoleButNoPerm.id },
        data: {
          roles: { connect: { id: noPermissionRole.id } },
        },
      }),
      client.userOnChat.update({
        where: { id: memberWithRoleManagePerm.id },
        data: {
          roles: {
            connect: [{ id: roleManager.id }, { id: noPermissionRole.id }],
          },
        },
      }),
      client.userOnChat.update({
        where: {
          id: memberWithHighestRole.id,
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
  });

  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          roleId: idGenerator(),
          payload: { memberIds: [idGenerator()] },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          roleId: idGenerator(),
          payload: { memberIds: [idGenerator()] },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          roleId: idGenerator(),
          payload: { memberIds: [idGenerator()] },
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
        const { roleId, payload, token, includeAuth } = data;

        const res = await request.role.patch.members(
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

  describe("Not Found Errors", () => {
    const scenarios = [
      {
        scenario: "chat does not exist",
        data: {
          chatId: idGenerator(),
          roleId: idGenerator(),
          token: user1AccessToken,
          payload: { memberIds: [idGenerator()] },
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "non-member updating a private chat",
        data: {
          chatId: directChatId,
          token: user3AccessToken,
          payload: { memberIds: [idGenerator()] },
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "role does not exist",
        data: {
          roleId: idGenerator(),
          token: user1AccessToken,
          payload: { memberIds: [idGenerator()] },
        },
        expectedError: { code: 404, message: "Role not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, payload, token } = data;

        const role = await client.role.findFirst({
          where: {
            chat: { id: chatId ?? groupChatId },
          },
        });

        const res = await request.role.patch.members(
          chatId ?? groupChatId,
          roleId ?? role.id,
          payload,
          token
        );

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    const getRoleId = (scenario) => {
      if (scenario.includes("higher")) {
        return highestRoleLevelId;
      }

      if (scenario.includes("equal")) {
        return roleManagerId;
      }

      if (scenario.includes("default role")) {
        return defaultRoleId;
      }

      return adminRoleId;
    };

    const scenarios = [
      {
        scenario: "a non-member tries to update role",
        data: {
          token: nonMemberAccessToken,
          includeAuth: true,
          payload: validForm,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to update roles",
        },
      },
      {
        scenario:
          "member role without permission attempts to add a members to role",
        data: {
          token: user4AccessToken,
          includeAuth: true,
          payload: validForm,
        },
        expectedError: {
          code: 403,
          message: "Missing permission: admin or manage_role",
        },
      },
      {
        scenario:
          "member with a role and permission equal to the target role level attempts to add new members",
        data: {
          token: user5AccessToken,
          includeAuth: true,
          payload: validForm,
        },
        expectedError: {
          code: 403,
          message: "You cannot update members of a higher or equal role level",
        },
      },
      {
        scenario:
          "member with a role and permission lower to the target role level attempts to add new members",
        data: {
          token: user5AccessToken,
          includeAuth: true,
          payload: validForm,
        },
        expectedError: {
          code: 403,
          message: "You cannot update members of a higher or equal role level",
        },
      },
      {
        scenario: "a owner trying to add a new members to a default role",
        data: {
          token: user1AccessToken,
          includeAuth: true,
          payload: validForm,
        },
        expectedError: {
          code: 403,
          message: "You are not allowed to modify members of a default role",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ scenario, data, expectedError }) => {
        const { roleId, payload, token } = data;

        const res = await request.role.patch.members(
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

  describe("Validation Errors", () => {
    const duplicateId = idGenerator();

    const scenarios = [
      {
        scenario: "chat ID invalid format",
        data: {
          chatId: "invalid_id_format",
          token: user1AccessToken,
          payload: {
            memberIds: [idGenerator()],
          },
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "role ID invalid format",
        data: {
          roleId: "invalid_id_format",
          token: user1AccessToken,
          payload: {
            memberIds: [idGenerator()],
          },
        },
        expectedError: { path: ["roleId"], code: "invalid_string" },
      },
      {
        scenario: "member IDs invalid format",
        data: {
          token: user1AccessToken,
          payload: {
            memberIds: ["invalid_id_format"],
          },
        },
        expectedError: { path: ["memberIds", 0], code: "invalid_string" },
      },
      {
        scenario: "dublicate member IDs invalid format",
        data: {
          token: user1AccessToken,
          payload: {
            memberIds: [duplicateId, duplicateId],
          },
        },
        expectedError: { path: ["memberIds"], code: "custom" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, payload, token } = data;

        const role = await client.role.findFirst({
          where: {
            roleLevel: 5,
            chat: { id: groupChatId },
          },
        });

        const res = await request.role.patch.members(
          chatId ?? groupChatId,
          roleId ?? role.id,
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
    beforeEach(async () => {
      const member = await client.userOnChat.create({
        data: {
          user: { connect: { id: nonMemberId } },
          chat: { connect: { id: groupChatId } },
        },
        select: { id: true },
      });

      return async () => client.userOnChat.delete({ where: { id: member.id } });
    });

    it("returns 204 (NO_CONTENT) when chat owner updates members of the highest role", async () => {
      const res = await request.role.patch.members(
        groupChatId,
        highestRoleLevelId,
        validForm,
        user1AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: highestRoleLevelId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const expectedUpdatedMembers = expect.arrayContaining([
        expect.objectContaining({
          user: { id: nonMemberId },
        }),
      ]);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(updatedRole.members).toEqual(expectedUpdatedMembers);
    });

    it("returns 204 (NO_CONTENT) when a member with top role and admin permission updates another admin role’s members", async () => {
      const res = await request.role.patch.members(
        groupChatId,
        adminRoleId,
        validForm,
        user2AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: adminRoleId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const expectedUpdatedMembers = expect.arrayContaining([
        expect.objectContaining({
          user: { id: nonMemberId },
        }),
      ]);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(updatedRole.members).toEqual(expectedUpdatedMembers);
    });

    it("returns (NO_CONTENT) when a member who has role that has manage_role permission updates members of lower rolereturns 204 (NO_CONTENT) when a member with manage_role permission updates members of a lower role", async () => {
      const res = await request.role.patch.members(
        groupChatId,
        lowestRoleId,
        validForm,
        user3AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: lowestRoleId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const expectedUpdatedMembers = expect.arrayContaining([
        expect.objectContaining({
          user: { id: nonMemberId },
        }),
      ]);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(updatedRole.members).toEqual(expectedUpdatedMembers);
    });
  });
});
