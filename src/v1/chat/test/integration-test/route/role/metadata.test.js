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

  await Promise.all([
    request.member.post.joinMember(groupChatResult.body.id, user2AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user3AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user4AccessToken),
    request.member.post.joinMember(groupChatResult.body.id, user5AccessToken),
  ]);

  groupChatId = groupChatResult.body.id;
  directChatId = directChatResult.body.id;

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

describe("Metadata", () => {
  let highestRoleLevelId;
  let adminRoleId;
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
    lowestRoleId = lowestRole.id;
    defaultRoleId = defaultRole.id;
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

        const res = await request.role.patch.metaData(
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
        data: {
          payload: { permissions: ["admin"] },

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
        data: {
          roleId: highestRoleLevelId,
          payload: { permissions: ["admin"] },
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
        data: {
          payload: { permissions: ["admin"] },
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
      async ({ scenario, data, expectedError }) => {
        const { roleId, payload, token } = data;

        const res = await request.role.patch.metaData(
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
      const res = await request.role.patch.metaData(
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
    const duplicateName = "admin";

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
        scenario: "permission at index 0 has an invalid string",
        data: {
          payload: {
            permissions: ["invalid_id_format", "admin"],
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["permissions", 0], code: "invalid_enum_value" },
      },
      {
        scenario: "duplicate permission ID in the array",

        data: {
          payload: {
            permissions: [duplicateName, duplicateName],
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["permissions"], code: "custom" },
      },
    ])(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, roleId, payload, token } = data;

        const res = await request.role.patch.metaData(
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

        const res = await request.role.patch.metaData(
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

        const res = await request.role.patch.metaData(
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

        const res = await request.role.patch.metaData(
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
        select: { name: true },
      });

      const payload = { permissions: permissions.map(({ name }) => name) };

      const res = await request.role.patch.metaData(
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
        select: { name: true },
      });

      const payload = { permissions: permissions.map(({ name }) => name) };

      const res = await request.role.patch.metaData(
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
        select: { name: true },
      });

      const payload = { permissions: permissions.map(({ name }) => name) };

      const res = await request.role.patch.metaData(
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
