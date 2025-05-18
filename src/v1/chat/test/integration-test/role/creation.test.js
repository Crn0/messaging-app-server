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
  ids: { user1Id, user2Id, user3Id },
  accessTokens: {
    user1AccessToken,
    user2AccessToken,
    user3AccessToken,
    user4AccessToken,
    user5AccessToken: nonMemberAccessToken,
  },
  invalidTokens: { user2InvalidToken },
  expiredTokens: { user2ExpiredToken },
} = await setupTestUsers(5);

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

describe("Role creation", () => {
  beforeAll(async () => {
    const [highestRoleLevel, adminRole] = await client.$transaction([
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
              name: "admin",
            },
          },
        },
      }),
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
              name: "manage_role",
            },
          },
        },
      }),
    ]);

    const [memberWithHighestRole, memberWithAdminRole] =
      await client.$transaction([
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
      ]);

    const [roleManagerMember] = await client.$transaction([
      client.userOnChat.update({
        where: {
          id: memberWithAdminRole.id,
        },
        data: {
          roles: { connect: { id: adminRole.id } },
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

    return async () => {
      const memberIds = [roleManagerMember.id];

      const roleIds = [highestRoleLevel.id, adminRole.id];

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

  describe("Authentication Errors", () => {
    const scenarios = [
      {
        scenario: "invalid token",
        data: {
          payload: { name: "test_role_name" },
          token: user2InvalidToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "expired token",
        data: {
          payload: { name: "test_role_name" },
          token: user2ExpiredToken,
          includeAuth: true,
        },
        expectedError: { code: 401, message: "Invalid or expired token" },
      },
      {
        scenario: "missing 'Authorization' header",
        data: {
          payload: { name: "test_role_name" },
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

        const res = await request.role.post.createRole(
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
    const scenarios = [
      {
        scenario: "non-member creating roles",
        data: {
          payload: { name: "test_role" },
          token: nonMemberAccessToken,
          includeAuth: true,
        },
        expectedError: {
          code: 403,
          message: "You must be a chat member to create chat roles",
        },
      },
      {
        scenario: "member creating roles without permission",
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
    ];

    it.each(scenarios)(
      "fails with 403 when $scenario",
      async ({ data, expectedError }) => {
        const { payload, token } = data;

        const res = await request.role.post.createRole(
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
          payload: { name: "test_role_name" },
          token: user2AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
      {
        scenario: "non-member creating private chat's role",
        data: {
          chatId: directChatId,
          payload: { name: "test_role_name" },
          token: user3AccessToken,
        },
        expectedError: { code: 404, message: "Chat not found" },
      },
    ];

    it.each(scenarios)(
      "fails with 404 for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await request.role.post.createRole(chatId, payload, token);

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
          payload: {
            name: "test_created_role",
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["chatId"], code: "invalid_string" },
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
        scenario: "name invalid type",
        data: {
          payload: {
            name: 42,
          },
          token: user2AccessToken,
        },
        expectedError: { path: ["name"], code: "invalid_type" },
      },
    ];

    it.each(scenarios)(
      "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
      async ({ data, expectedError }) => {
        const { chatId, payload, token } = data;

        const res = await request.role.post.createRole(
          chatId ?? groupChatId,
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
    it("returns 200 (OK) with the created role when the chat owner creates a role", async () => {
      const payload = { name: "created_role_by_owner" };

      const res = await request.role.post.createRole(
        groupChatId,
        payload,
        user1AccessToken
      );

      const toMatchObject = {
        id: expect.any(String),
        name: expect.any(String),
        roleLevel: expect.any(Number),
        isDefaultRole: expect.any(Boolean),
        chatId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: null,
        permissions: expect.any(Array),
      };

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("pk");
      expect(res.body).toMatchObject(toMatchObject);
      expect(res.body.roleLevel).toBe(3);

      const role = await client.role.findUnique({ where: { id: res.body.id } });

      expect(role).not.toBeNull();
      expect(role.id).toBe(res.body.id);

      await client.role.delete({ where: { id: res.body.id } });
    });

    it("returns 200 (OK) with the created role when a member with 'manage_role' creates a role", async () => {
      const payload = { name: "created_role_with_manage_role_permission" };

      const res = await request.role.post.createRole(
        groupChatId,
        payload,
        user3AccessToken
      );

      const toMatchObject = {
        id: expect.any(String),
        name: expect.any(String),
        roleLevel: expect.any(Number),
        isDefaultRole: expect.any(Boolean),
        chatId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: null,
        permissions: expect.any(Array),
      };

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("pk");
      expect(res.body).toMatchObject(toMatchObject);
      expect(res.body.roleLevel).toBe(3);

      const role = await client.role.findUnique({ where: { id: res.body.id } });

      expect(role).not.toBeNull();
      expect(role.id).toBe(res.body.id);

      await client.role.delete({ where: { id: res.body.id } });
    });
  });
});
