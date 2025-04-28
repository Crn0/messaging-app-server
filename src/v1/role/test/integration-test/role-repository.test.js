import { describe, it, expect, beforeAll } from "vitest";
import { idGenerator } from "../../util.js";
import client from "../../../../db/client.js";
import userFactory from "../utils/user-factory.js";
import roleRepository from "../../role-repository.js";
import permissionNames from "../data/permissions.js";

let permissionIds;

const User = userFactory();

const user = await User.create(1);

const { data: userData, entity: userEntity } = user;

const { username, id: userId } = userData;

const chatId = idGenerator();

beforeAll(async () => {
  await client.$transaction([
    client.user.create({
      data: {
        ...userEntity,
      },
    }),

    client.chat.create({
      data: {
        id: chatId,
        name: `${username}'s group-chat`,
        type: "GroupChat",
        owner: {
          connect: {
            id: userId,
          },
        },
        members: {
          create: {
            user: {
              connect: {
                id: userId,
              },
            },
          },
        },
      },
    }),
  ]);

  const permissions = await client.permission.createManyAndReturn({
    data: permissionNames.map((name) => ({ name })),
    select: { id: true },
  });

  permissionIds = permissions.map(({ id }) => id);

  return async () => {
    await client.$transaction([
      client.user.delete({ where: { id: userId } }),
      client.chat.delete({ where: { id: chatId } }),
      client.permission.deleteMany({ where: { id: { in: permissionIds } } }),
    ]);
  };
});

describe("Role creation", () => {
  it("creates a role and returns the created role object", async () => {
    const data = {
      chatId,
      name: "test_role",
      isDefaultRole: false,
    };

    const role = await roleRepository.insert(data);

    const toMatchObject = {
      name: "test_role",
      roleLevel: 1,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: [],
    };

    expect(role).toMatchObject(toMatchObject);
    expect(role).not.toHaveProperty("pk");

    await client.role.delete({ where: { id: role.id } });
  });

  it("creates a default role with permissions and returns the created object", async () => {
    const data = {
      chatId,
      permissionIds,
      name: "create_role_with_permissions",
      isDefaultRole: true,
    };

    const role = await roleRepository.insert(data);

    const toMatchObject = {
      name: "create_role_with_permissions",
      roleLevel: null,
      isDefaultRole: true,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: expect.any(Array),
    };

    const toEqual = expect.arrayContaining(
      permissionIds.map((id) => expect.objectContaining({ id }))
    );

    expect(role).toMatchObject(toMatchObject);
    expect(role.permissions).toEqual(toEqual);
    expect(role).not.toHaveProperty("pk");

    await client.role.delete({ where: { id: role.id } });
  });
});

describe("Role detail", () => {
  let roleId;

  beforeAll(async () => {
    const roles = await Promise.all(
      Array.from({ length: 10 }, (_, i) => i).map(async (val) =>
        client.role.create({
          data: {
            name: `test_role_${val + 1}`,
            roleLevel: val + 1,
            isDefaultRole: false,
            chat: {
              connect: {
                id: chatId,
              },
            },
          },
          select: {
            id: true,
          },
        })
      )
    );

    roleId = roles[0].id;

    return async () => {
      await client.role.deleteMany({
        where: {
          id: { in: roles.map(({ id }) => id) },
        },
      });
    };
  });

  it("returns the role by chat and role ID", async () => {
    const role = await roleRepository.findChatRoleById(roleId, chatId);

    const toMatchObject = {
      chatId,
      name: "test_role_1",
      roleLevel: 1,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: [],
    };

    expect(role).not.toHaveProperty("pk");
    expect(role).toMatchObject(toMatchObject);
  });

  it("returns a list of roles by chat ID", async () => {
    const roles = await roleRepository.findChatRolesById(chatId);

    const toEqual = Array.from({ length: 10 }, (_, i) => i).map((val, index) =>
      expect.objectContaining({
        chatId,
        name: `test_role_${val + 1}`,
        roleLevel: index + 1,
        isDefaultRole: false,
        createdAt: expect.any(Date),
        updatedAt: null,
        permissions: [],
      })
    );

    expect(roles[0]).not.toHaveProperty("pk");
    expect(roles).toEqual(toEqual);
  });

  it("returns a list of default roles by chat ID", async () => {
    const data = {
      chatId,
      permissionIds,
      name: "default_role_with_permissions",
      isDefaultRole: true,
    };

    const createdRole = await roleRepository.insert(data);

    const roles = await roleRepository.findChatDefaultRolesById(chatId);

    const toMatchObject = {
      chatId,
      name: "default_role_with_permissions",
      roleLevel: null,
      isDefaultRole: true,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: expect.any(Array),
    };

    expect(roles[0]).toMatchObject(toMatchObject);
    expect(roles.every((role) => role.isDefaultRole === true)).toBeTruthy();

    await client.role.delete({ where: { id: createdRole.id } });
  });
});

describe("Role update", () => {
  beforeAll(async () => {
    const roles = await Promise.all(
      Array.from({ length: 2 }, (_, i) => i).map(async (val) =>
        client.role.create({
          data: {
            name: `test_role_${val + 1}`,
            roleLevel: val + 1,
            isDefaultRole: false,
            chat: {
              connect: {
                id: chatId,
              },
            },
          },
          select: {
            id: true,
          },
        })
      )
    );

    return async () => {
      await client.role.deleteMany({
        where: { id: { in: roles.map(({ id }) => id) } },
      });
    };
  });

  it("updates the role's display and return the updated object", async () => {
    const role = await client.role.create({
      data: {
        name: "test_role_3",
        roleLevel: 3,
        isDefaultRole: false,
        chat: {
          connect: {
            id: chatId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const data = {
      chatId,
      roleId: role.id,
      name: "updated_role_1",
    };

    const updatedRole = await roleRepository.updateChatRoleDisplay(data);

    const toMatchObject = {
      chatId,
      id: expect.any(String),
      name: "updated_role_1",
      roleLevel: 3,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: [],
    };

    expect(updatedRole).not.toHaveProperty("pk");
    expect(updatedRole).toMatchObject(toMatchObject);

    await client.role.delete({ where: { id: updatedRole.id } });
  });

  it("updates the role's permissions and return the updated object", async () => {
    const role = await client.role.create({
      data: {
        name: "test_role_3",
        roleLevel: 3,
        isDefaultRole: false,
        chat: {
          connect: {
            id: chatId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const data = {
      chatId,
      permissionIds,
      roleId: role.id,
    };

    const updatedRole = await roleRepository.updateChatRolePermissions(data);

    const toMatchObject = {
      chatId,
      id: expect.any(String),
      name: "test_role_3",
      roleLevel: 3,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: expect.any(Array),
    };

    const toEqual = expect.arrayContaining(
      permissionIds.map((id) => expect.objectContaining({ id }))
    );

    expect(updatedRole).not.toHaveProperty("pk");
    expect(updatedRole).toMatchObject(toMatchObject);
    expect(updatedRole.permissions).toEqual(toEqual);

    await client.role.delete({ where: { id: updatedRole.id } });
  });

  it("updates the role's members and return the updated object", async () => {
    const role = await client.role.create({
      data: {
        name: "test_role_3",
        roleLevel: 3,
        isDefaultRole: false,
        chat: {
          connect: {
            id: chatId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const data = {
      chatId,
      roleId: role.id,
      membersId: [userId],
    };

    const updatedRole = await roleRepository.updateChatRoleMembers(data);

    const { members } = await client.role.findUnique({
      where: { id: role.id },
      select: { members: { select: { user: { select: { id: true } } } } },
    });

    const toMatchObject = {
      chatId,
      id: expect.any(String),
      name: "test_role_3",
      roleLevel: 3,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: expect.any(Array),
    };

    expect(updatedRole).not.toHaveProperty("pk");
    expect(updatedRole).toMatchObject(toMatchObject);
    expect(members[0].user.id).toBe(userId);

    await client.role.delete({ where: { id: updatedRole.id } });
  });

  it("updates the roles role level based on the index and return the updated objects", async () => {
    const roles = await client.role.findMany({
      orderBy: {
        roleLevel: "desc",
      },
      where: {
        chat: {
          id: chatId,
        },
      },
      select: {
        id: true,
      },
    });

    const rolesId = roles.sort().map(({ id }) => id);

    const data = {
      chatId,
      rolesId,
    };

    const updatedRoles = await roleRepository.updateChatRolesRoleLevel(data);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        chatId,
        id: expect.any(String),
        name: "test_role_2",
        roleLevel: 1,
        isDefaultRole: false,
        createdAt: expect.any(Date),
        updatedAt: null,
        permissions: expect.any(Array),
      }),
      expect.objectContaining({
        chatId,
        id: expect.any(String),
        name: "test_role_1",
        roleLevel: 2,
        isDefaultRole: false,
        createdAt: expect.any(Date),
        updatedAt: null,
        permissions: expect.any(Array),
      }),
    ]);

    expect(updatedRoles).toEqual(toEqual);
  });
});

describe("Role deletion", () => {
  it("deletes the role by role and chat ID and returns the deleted object", async () => {
    const role = await client.role.create({
      data: {
        name: "test_role_1",
        roleLevel: 1,
        isDefaultRole: false,
        chat: {
          connect: {
            id: chatId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const deletedRole = await roleRepository.deleteChatRoleById(
      role.id,
      chatId
    );

    const toMatchObject = {
      chatId,
      name: "test_role_1",
      roleLevel: 1,
      isDefaultRole: false,
      createdAt: expect.any(Date),
      updatedAt: null,
      permissions: [],
    };

    expect(deletedRole).toMatchObject(toMatchObject);
    await expect(
      client.role.findUnique({ where: { id: role.id } })
    ).resolves.toBeNull();
  });
});
