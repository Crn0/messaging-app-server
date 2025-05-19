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

describe("Role deletion", () => {
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
    ];

    it.each(scenarios)(
      "fails with 401 (UNAUTHORIZED) for $scenario",
      async ({ data, expectedError }) => {
        const { roleId, token, includeAuth } = data;

        const res = await request.role.delete.role(groupChatId, roleId, token, {
          includeAuth,
        });

        expect(res.status).toBe(401);
        expect(res.body).toMatchObject(expectedError);
      }
    );
  });

  describe("Forbidden Errors", () => {
    const getRoleIds = (scenario) => {
      if (scenario.includes("equal") || scenario.includes("higher"))
        return highestRoleLevelId;

      if (scenario.includes("default")) return defaultRoleId;

      return adminRoleId;
    };

    const scenarios = [
      {
        scenario: "non-member deleting role",
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
        scenario: "member without permissions deleting role",
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
        scenario: "owner deleting a default role",
        data: {
          token: user1AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You are not allowed to delete a default role",
        },
      },
      {
        scenario: "deleting a equal ranked role",
        data: {
          token: user2AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot delete a higher or equal role level",
        },
      },
      {
        scenario: "deleting a higher ranked role",
        data: {
          roleId: highestRoleLevelId,
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot delete a higher or equal role level",
        },
      },
      {
        scenario:
          "higher-role lacks permission, lower-role has it — delete role",
        data: {
          payload: { name: "test_role" },
          token: user5AccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You cannot delete a higher or equal role level",
        },
      },
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ scenario, data, expectedError }) => {
        const { token } = data;
        const chatId = data.chatId ?? groupChatId;
        const roleId = getRoleIds(scenario);

        const res = await request.role.delete.role(chatId, roleId, token);

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
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "role does not exist",
        data: {
          roleId: idGenerator(),
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Role not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { token } = data;
        const chatId = data.chatId ?? directChatId;

        const roleId = data.roleId ?? roleManagerId;

        const res = await request.role.delete.role(chatId, roleId, token);

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
          roleId: idGenerator(),
          token: user1AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
      },
      {
        scenario: "role ID invalid format",
        data: {
          roleId: "invalid_id_format",
          token: user1AccessToken,
        },
        expectedError: { path: ["roleId"], code: "invalid_string" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, token, includeAuth } = data;

        const res = await request.role.delete.role(
          chatId ?? groupChatId,
          roleId,
          token,
          {
            includeAuth,
          }
        );

        expect(res.status).toBe(422);
        expect(res.body.errors).toContainEqual(
          expect.objectContaining(expectedError)
        );
      }
    );
  });

  describe("Success case", () => {
    const getRoleId = async (chatId, target) => {
      const where = { chat: { id: chatId }, isDefaultRole: false };
      const select = { id: true };

      if (target.includes("lower")) {
        return (
          await client.role.findMany({
            where,
            select,
            orderBy: { roleLevel: "desc" },
          })
        )[0]?.id;
      }

      if (target.includes("highest")) {
        return (
          await client.role.findMany({
            where,
            select,
            orderBy: { roleLevel: "asc" },
          })
        )[0]?.id;
      }

      return adminRoleId;
    };

    const scenarios = [
      {
        token: user2AccessToken,
        actor: "a member with the highest manage_role permission",
        target: "a lower-level role",
      },
      {
        token: user5AccessToken,
        actor: "a member with manage_role permission (not highest)",
        target: "a lower-level role",
      },
      {
        token: user3AccessToken,
        actor: "a member with admin permission",
        target: "a lower-level role",
      },
      {
        token: user2AccessToken,
        actor: "a member with the highest manage_role permission",
        target: "an admin role",
      },
      {
        token: user1AccessToken,
        actor: "the chat owner",
        target: "the highest role",
      },
    ];

    it.each(scenarios)(
      "returns 204 (NO_CONTENT) when $actor deletes $target",
      async ({ token, target }) => {
        const chatId = groupChatId;
        const roleId = await getRoleId(chatId, target);

        const res = await request.role.delete.role(chatId, roleId, token);

        expect(res.status).toBe(204);

        const roles = await client.role.findMany({
          orderBy: { roleLevel: "asc" },
          where: { chat: { id: chatId }, isDefaultRole: false },
          select: { name: true, id: true, roleLevel: true },
        });

        expect(roles.every((role) => role.id === roleId)).toBeFalsy();
      }
    );
  });
});
