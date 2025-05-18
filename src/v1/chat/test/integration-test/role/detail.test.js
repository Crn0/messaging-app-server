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
  expiredTokens: { user2ExpiredToken },
  invalidTokens: { user2InvalidToken },
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

describe("Role detail", () => {
  let highestRoleLevelId;

  beforeAll(async () => {
    const [highestRoleLevel, adminRole] = await client.$transaction([
      client.role.create({
        data: {
          name: "test_admin_role",
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
          name: "test_create_role",
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

    await client.$transaction([
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

    highestRoleLevelId = highestRoleLevel.id;

    return async () => {
      const roleIds = [highestRoleLevel.id, adminRole.id];

      await client.role.deleteMany({
        where: { id: { in: roleIds } },
      });
    };
  });

  describe("Role list", () => {
    describe("Authentication Errors", () => {
      const scenarios = [
        {
          scenario: "invalid token",
          data: {
            token: user2InvalidToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "expired token",
          data: {
            token: user2ExpiredToken,
            includeAuth: true,
          },
          expectedError: { code: 401, message: "Invalid or expired token" },
        },
        {
          scenario: "missing 'Authorization' header",
          data: {
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
          const { token, includeAuth } = data;

          const res = await request.role.get.roleList(groupChatId, token, {
            includeAuth,
          });

          expect(res.status).toBe(401);
          expect(res.body).toMatchObject(expectedError);
        }
      );
    });

    describe("Forbidden Errors", () => {
      const scenarios = [
        {
          scenario: "non-member requesting to view the roles",
          data: {
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to view chat roles",
          },
        },
        {
          scenario:
            "member without the permission requesting to view the roles",
          data: {
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
          const { token } = data;

          const res = await request.role.get.roleList(groupChatId, token);

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
          scenario: "user requesting a private chat's roles",
          data: {
            chatId: directChatId,
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
      ];

      it.each(scenarios)(
        "fails with 404 for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await request.role.get.roleList(chatId, token);

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
            token: user2AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, token } = data;

          const res = await request.role.get.roleList(
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

    // Success case unchanged
  });

  describe("Role by ID", () => {
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

          const res = await request.role.get.roleById(
            groupChatId,
            roleId,
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
          scenario: "non-member requesting to view the roles",
          data: {
            token: nonMemberAccessToken,
            includeAuth: true,
          },
          expectedError: {
            code: 403,
            message: "You must be a chat member to view chat roles",
          },
        },
        {
          scenario:
            "member without the permission requesting to view the roles",
          data: {
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
          const { token } = data;

          const res = await request.role.get.roleById(
            groupChatId,
            highestRoleLevelId,
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
            roleId: idGenerator(),
            token: user2AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "user requesting a private chat's role",
          data: {
            chatId: directChatId,
            roleId: idGenerator(),
            token: user3AccessToken,
          },
          expectedError: { code: 404, message: "Chat not found" },
        },
        {
          scenario: "Role not found",
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

          const res = await request.role.get.roleById(
            chatId ?? groupChatId,
            roleId ?? highestRoleLevelId,
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
            token: user2AccessToken,
          },
          expectedError: { path: ["chatId"], code: "invalid_string" },
        },
        {
          scenario: "chat ID invalid format",
          data: {
            roleId: "invalid_id_format",
            token: user2AccessToken,
          },
          expectedError: { path: ["roleId"], code: "invalid_string" },
        },
      ];

      it.each(scenarios)(
        "fails with 422 (UNPROCESSABLE_ENTITY) for $scenario",
        async ({ data, expectedError }) => {
          const { chatId, roleId, token } = data;

          const res = await request.role.get.roleById(
            chatId ?? groupChatId,
            roleId ?? highestRoleLevelId,
            token
          );

          expect(res.status).toBe(422);
          expect(res.body.errors).toContainEqual(
            expect.objectContaining(expectedError)
          );
        }
      );
    });

    // Success case unchanged
  });
});
