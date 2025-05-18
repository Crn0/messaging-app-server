import req from "supertest";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
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

describe("Remove members", () => {
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
          memberId: idGenerator(),
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          roleId: idGenerator(),
          memberId: idGenerator(),
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          roleId: idGenerator(),
          memberId: idGenerator(),
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
        const { roleId, memberId, token, includeAuth } = data;

        const res = await request.role.delete.member(
          groupChatId,
          roleId,
          memberId,
          token,
          { includeAuth }
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
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "non-member updating a private chat",
        data: {
          chatId: directChatId,
          token: user3AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "role does not exist",
        data: {
          roleId: idGenerator(),
          token: user1AccessToken,
        },
        expectedError: { code: 404, message: "Role not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, token } = data;

        const role = await client.role.findFirst({
          where: {
            chat: { id: chatId ?? groupChatId },
          },
          select: {
            id: true,
            members: { select: { user: { select: { id: true } } } },
          },
        });

        const memberId = role?.members?.[0]?.user?.id ?? idGenerator();

        const res = await request.role.delete.member(
          chatId ?? groupChatId,
          roleId ?? role.id,
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
        scenario: "a non-member tries to update role",
        data: {
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to update roles",
        },
      },
      {
        scenario:
          "member role without permission attempts to remove a member to role",
        data: {
          token: user4AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "Missing permission: admin or manage_role",
        },
      },
      {
        scenario:
          "member with a role and permission equal to the target role level attempts to remove a member",
        data: {
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update members of a higher or equal role level",
        },
      },
      {
        scenario:
          "member with a role and permission lower to the target role level attempts to remove a member",
        data: {
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot update members of a higher or equal role level",
        },
      },
      {
        scenario: "a owner trying to remove a new member to a default role",
        data: {
          token: user1AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not allowed to modify members of a default role",
        },
      },
    ];

    const getRoleId = (scenario) => {
      if (scenario.includes("higher")) return highestRoleLevelId;
      if (scenario.includes("equal")) return roleManagerId;
      if (scenario.includes("default role")) return defaultRoleId;
      return adminRoleId;
    };

    const getMemberIdByRoleId = (roleId) => {
      if (roleId === highestRoleLevelId) return user2Id;
      if (roleId === adminRoleId) return user3Id;
      return user5Id;
    };

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ scenario, data, expectedError }) => {
        const { token } = data;
        const roleId = data?.roleId ?? getRoleId(scenario);
        const memberId = getMemberIdByRoleId(roleId);

        const res = await request.role.delete.member(
          groupChatId,
          roleId,
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
          roleId: idGenerator(),
          memberId: idGenerator(),
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
          memberId: idGenerator(),
          token: user1AccessToken,
          payload: {
            memberIds: [idGenerator()],
          },
        },
        expectedError: { path: ["roleId"], code: "invalid_string" },
      },
      {
        scenario: "member ID invalid format",
        data: {
          token: user1AccessToken,
          payload: {
            memberIds: ["invalid_id_format"],
          },
        },
        expectedError: { path: ["memberId"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, memberId, token } = data;

        const res = await request.role.delete.member(
          chatId ?? groupChatId,
          roleId,
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
    let memberId;

    beforeEach(async () => {
      const member = await client.userOnChat.create({
        data: {
          user: { connect: { id: nonMemberId } },
          chat: { connect: { id: groupChatId } },
        },
        select: { id: true },
      });

      memberId = member.id;

      return async () => client.userOnChat.delete({ where: { id: member.id } });
    });

    it("returns 204 (NO_CONTENT) when the chat owner removes a member from the highest role", async () => {
      await client.userOnChat.update({
        where: { id: memberId },
        data: {
          roles: { connect: { id: highestRoleLevelId } },
        },
      });

      const res = await request.role.delete.member(
        groupChatId,
        highestRoleLevelId,
        nonMemberId,
        user1AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: highestRoleLevelId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const memberIds = updatedRole.members.map((m) => m.user.id);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(memberIds).not.toContain(nonMemberId);
    });

    it("returns 204 (NO_CONTENT) when a member with top role and admin permission removes a member from  a lower role with admin permission", async () => {
      await client.userOnChat.update({
        where: { id: memberId },
        data: {
          roles: { connect: { id: adminRoleId } },
        },
      });

      const res = await request.role.delete.member(
        groupChatId,
        adminRoleId,
        nonMemberId,
        user2AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: highestRoleLevelId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const memberIds = updatedRole.members.map((m) => m.user.id);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(memberIds).not.toContain(nonMemberId);
    });

    it("returns (NO_CONTENT) when a member who has role that has manage_role permission remove a  member of lower role", async () => {
      await client.userOnChat.update({
        where: { id: memberId },
        data: {
          roles: { connect: { id: lowestRoleId } },
        },
      });

      const res = await request.role.delete.member(
        groupChatId,
        lowestRoleId,
        nonMemberId,
        user3AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRole = await client.role.findUnique({
        where: { id: highestRoleLevelId },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const memberIds = updatedRole.members.map((m) => m.user.id);

      expect(new Date(updatedRole.updatedAt)).not.toBeNull();
      expect(memberIds).not.toContain(nonMemberId);
    });
  });
});
