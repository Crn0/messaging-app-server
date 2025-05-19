import req from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../../../db/client.js";
import app from "../../../utils/server.js";
import {
  baseRequest,
  userFactory,
  createRole,
  findUserOnChat,
  assignRolesToUser,
  setupTestUsers as initSetupUsers,
} from "../../../utils/index.js";
import { idGenerator } from "../../../../utils.js";

const request = baseRequest({ request: req(app), url: "/api/v1" });

const User = userFactory();
const setupTestUsers = initSetupUsers(User);

const {
  users,
  entities,
  ids: { user1Id, user2Id, user3Id, user4Id, user5Id },
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

describe("Role level", () => {
  let highestRoleLevelId;
  let adminRoleId;
  let roleManagerId;
  let defaultRoleId;

  beforeAll(async () => {
    const chat = await client.chat.findUnique({
      where: { id: groupChatId },
      select: { pk: true },
    });

    await client.chatRoleCounter.update({
      where: { chatPk: chat.pk },
      data: { lastLevel: 4 },
    });

    const [highestRoleLevel, noPermissionRole, adminRole, roleManager] =
      await Promise.all([
        createRole("test_highest_role", 1, groupChatId, ["manage_role"]),
        createRole("test_role_no_permission", 2, groupChatId),
        createRole("test_admin_role", 3, groupChatId, ["admin"]),
        createRole("test_lowest_ranked_role", 4, groupChatId, ["manage_role"]),
      ]);

    const defaultRole = await client.role.findFirst({
      where: {
        chat: { id: groupChatId },
        name: "everyone",
        isDefaultRole: true,
      },
    });

    const [
      memberWithHighestRole,
      memberWithAdminRole,
      memberWithRoleButNoPerm,
      memberWithRoleManagePerm,
    ] = await Promise.all([
      findUserOnChat(groupChatId, user2Id),
      findUserOnChat(groupChatId, user3Id),
      findUserOnChat(groupChatId, user4Id),
      findUserOnChat(groupChatId, user5Id),
    ]);

    await Promise.all([
      assignRolesToUser(memberWithAdminRole.id, adminRole.id),
      assignRolesToUser(memberWithRoleButNoPerm.id, noPermissionRole.id),
      assignRolesToUser(memberWithRoleManagePerm.id, [
        roleManager.id,
        noPermissionRole.id,
      ]),
      assignRolesToUser(memberWithHighestRole.id, highestRoleLevel.id),
    ]);

    for (let i = 0; i < 16; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request.role.post.createRole(
        groupChatId,
        { name: `role${4 + i + 1}` },
        user1AccessToken
      );
    }

    highestRoleLevelId = highestRoleLevel.id;
    adminRoleId = adminRole.id;
    roleManagerId = roleManager.id;
    defaultRoleId = defaultRole.id;
  });

  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          payload: { permissions: [] },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          payload: { permissions: [] },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          payload: { permissions: [] },
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
        const { payload, token, includeAuth } = data;

        const res = await request.role.patch.roleLevels(
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
    const getRoleIds = (scenario) => {
      if (scenario.includes("equal") || scenario.includes("lower"))
        return [roleManagerId, adminRoleId, highestRoleLevelId];

      if (scenario.includes("default"))
        return [defaultRoleId, roleManagerId, adminRoleId];

      return [roleManagerId, adminRoleId];
    };

    const scenarios = [
      {
        scenario: "non-member updating role levels",
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
        scenario: "member without permissions updating role levels",
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
        scenario: "owner updating the role level of a default role",
        data: {
          token: user1AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You are not allowed to modify the role level of a default role",
        },
      },
      {
        scenario: "equal-ranked member updating role levels",
        data: {
          payload: { name: "test_role" },
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update the role level of a higher or equal role level",
        },
      },
      {
        scenario: "lower-ranked member updating higher role levels",
        data: {
          roleId: highestRoleLevelId,
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update the role level of a higher or equal role level",
        },
      },
      {
        scenario:
          "higher-role lacks permission, lower-role has it — update role levels attempt",
        data: {
          payload: { name: "test_role" },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message:
            "You cannot update the role level of a higher or equal role level",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ scenario, data, expectedError }) => {
        const { token } = data;
        const payload = { roleIds: getRoleIds(scenario) };

        const res = await request.role.patch.roleLevels(
          groupChatId,
          payload,
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
          token: user2AccessToken,
          payload: { roleIds: [idGenerator(), idGenerator()] },
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "role does not exist",
        data: {
          token: user2AccessToken,
          payload: { roleIds: [idGenerator(), idGenerator()] },
        },
        expectedError: { code: 404, message: "Role not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { payload, token } = data;

        const chatId = data.chatId ?? groupChatId;

        const res = await request.role.patch.roleLevels(chatId, payload, token);

        expect(res.status).toBe(404);
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
            roleIds: [idGenerator()],
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
            roleIds: ["invalid_id_format", idGenerator()],
          },
        },
        expectedError: { path: ["roleIds", 0], code: "invalid_string" },
      },
      {
        scenario: "duplicate role IDs",
        data: {
          token: user1AccessToken,
          payload: {
            roleIds: [duplicateId, duplicateId, idGenerator()],
          },
        },
        expectedError: { path: ["roleIds"], code: "custom" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { payload, token } = data;
        const chatId = data.chatId ?? groupChatId;

        const res = await request.role.patch.roleLevels(chatId, payload, token);

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    it("returns 204 (NO_CONTENT) when the owner updates role levels in the range [20, 1]", async () => {
      const oldRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const roleIds = oldRoles
        .filter((role) => role.roleLevel === 1 || role.roleLevel === 20)
        .sort((a, b) => b.roleLevel - a.roleLevel)
        .map((role) => role.id);

      const res = await request.role.patch.roleLevels(
        groupChatId,
        { roleIds },
        user1AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const expectedUpdatedRoles = expect.arrayContaining(
        oldRoles
          .map((role) => {
            if (role.roleLevel === 1) return { ...role, roleLevel: 2 };
            if (role.roleLevel === 20) return { ...role, roleLevel: 1 };

            return { ...role, roleLevel: role.roleLevel + 1 };
          })
          .map((role) =>
            expect.objectContaining({ id: role.id, roleLevel: role.roleLevel })
          )
      );

      expect(updatedRoles).toEqual(expectedUpdatedRoles);

      await client.role.updateMany({
        where: { chat: { id: groupChatId } },
        data: { roleLevel: null },
      });
      await client.$transaction(
        oldRoles.map((role) =>
          client.role.update({
            where: { id: role.id },
            data: { roleLevel: role.roleLevel },
          })
        )
      );
    });

    it("returns 204 (NO_CONTENT) when a member with admin updates role levels in the range [20, 19, 18, 17, 4]", async () => {
      const oldRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const rolesToUpdate = [20, 19, 18, 17, 4];

      const roleIds = oldRoles
        .filter((role) => rolesToUpdate.includes(role.roleLevel))
        .sort((a, b) => b.roleLevel - a.roleLevel)
        .map((role) => role.id);

      const res = await request.role.patch.roleLevels(
        groupChatId,
        { roleIds },
        user2AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const reorderedLevelsMap = {
        20: 4,
        19: 5,
        18: 6,
        17: 7,
        4: 8,
      };

      const minRoleLevel = Math.min(...rolesToUpdate);
      const maxRoleLevel = Math.max(...rolesToUpdate);
      let roleLevelCounter = minRoleLevel + roleIds.length;

      const expectedUpdatedRoles = expect.arrayContaining(
        oldRoles
          .map((role) => {
            if (reorderedLevelsMap[role.roleLevel] !== undefined) {
              return { ...role, roleLevel: reorderedLevelsMap[role.roleLevel] };
            }

            if (
              role.roleLevel > minRoleLevel &&
              role.roleLevel < maxRoleLevel
            ) {
              const currentRoleLevel = roleLevelCounter;
              roleLevelCounter += 1;
              return { ...role, roleLevel: currentRoleLevel };
            }

            return role;
          })
          .map((role) =>
            expect.objectContaining({ id: role.id, roleLevel: role.roleLevel })
          )
      );

      expect(updatedRoles).toEqual(expectedUpdatedRoles);

      await client.role.updateMany({
        where: { chat: { id: groupChatId } },
        data: { roleLevel: null },
      });
      await client.$transaction(
        oldRoles.map((role) =>
          client.role.update({
            where: { id: role.id },
            data: { roleLevel: role.roleLevel },
          })
        )
      );
    });

    it("returns 204 (NO_CONTENT) when a member with admin updates role levels in the range [19, 8]", async () => {
      const oldRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const rolesToUpdate = [19, 8];

      const roleIds = oldRoles
        .filter((role) => rolesToUpdate.includes(role.roleLevel))
        .sort((a, b) => b.roleLevel - a.roleLevel)
        .map((role) => role.id);

      const res = await request.role.patch.roleLevels(
        groupChatId,
        { roleIds },
        user2AccessToken
      );

      expect(res.status).toBe(204);

      const updatedRoles = await client.role.findMany({
        orderBy: { roleLevel: "asc" },
        where: { chat: { id: groupChatId }, isDefaultRole: false },
      });

      const reorderedLevelsMap = {
        19: 8,
        8: 9,
      };

      const minRoleLevel = Math.min(...rolesToUpdate);
      const maxRoleLevel = Math.max(...rolesToUpdate);
      let roleLevelCounter = minRoleLevel + roleIds.length;

      const expectedUpdatedRoles = expect.arrayContaining(
        oldRoles
          .map((role) => {
            if (reorderedLevelsMap[role.roleLevel] !== undefined) {
              return { ...role, roleLevel: reorderedLevelsMap[role.roleLevel] };
            }

            if (
              role.roleLevel > minRoleLevel &&
              role.roleLevel < maxRoleLevel
            ) {
              const currentRoleLevel = roleLevelCounter;
              roleLevelCounter += 1;
              return { ...role, roleLevel: currentRoleLevel };
            }

            return role;
          })
          .map((role) =>
            expect.objectContaining({ id: role.id, roleLevel: role.roleLevel })
          )
      );

      expect(updatedRoles).toEqual(expectedUpdatedRoles);

      await client.role.updateMany({
        where: { chat: { id: groupChatId } },
        data: { roleLevel: null },
      });
      await client.$transaction(
        oldRoles.map((role) =>
          client.role.update({
            where: { id: role.id },
            data: { roleLevel: role.roleLevel },
          })
        )
      );
    });
  });
});
