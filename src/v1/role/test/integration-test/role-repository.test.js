import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { idGenerator } from "../../util.js";
import client from "../../../../db/client.js";
import userFactory from "../utils/user-factory.js";
import roleRepository from "../../role-repository.js";
import permissionNames from "../data/permissions.js";

const permissions = permissionNames;

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
    client.permission.createMany({
      data: permissions.map((perm) => ({ name: perm })),
      skipDuplicates: true,
    }),
  ]);

  return async () => {
    await client.$transaction([
      client.user.delete({ where: { id: userId } }),
      client.chat.delete({ where: { id: chatId } }),
      client.permission.deleteMany({
        where: { name: { in: permissionNames } },
      }),
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
      permissions,
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
      permissions.map((perm) => expect.objectContaining({ name: perm }))
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
    const userOnChat = await client.userOnChat.findFirst({
      where: {
        chat: {
          id: chatId,
        },
        user: {
          id: userId,
        },
      },
      select: {
        id: true,
      },
    });

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
            members: {
              connect: {
                id: userOnChat.id,
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
      permissions,
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

  it("returns a list of roles by chat and user ID", async () => {
    const roles = await roleRepository.findUserRolesById(chatId, userId);

    const toEqual = expect.arrayContaining(
      Array.from({ length: 10 }, (_, i) => i).map((val) =>
        expect.objectContaining({
          name: `test_role_${val + 1}`,
        })
      )
    );

    expect(roles).toEqual(toEqual);
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

  describe("Update name", () => {
    it("returns the updated object", async () => {
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

      const updatedRole = await roleRepository.updateChatRoleMetaData(role.id, {
        name: "updated_role_1",
      });

      const toMatchObject = {
        chatId,
        id: expect.any(String),
        name: "updated_role_1",
        roleLevel: 3,
        isDefaultRole: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        permissions: [],
      };

      expect(updatedRole).not.toHaveProperty("pk");
      expect(updatedRole).toMatchObject(toMatchObject);

      await client.role.delete({ where: { id: updatedRole.id } });
    });
  });

  describe("Update member", () => {
    it("insert a single member and returns the updated object", async () => {
      const role = await client.role.create({
        data: {
          name: "default_role",
          roleLevel: null,
          isDefaultRole: true,
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
        memberId: userId,
      };

      const updatedRole = await roleRepository.updateChatRoleMember(
        role.id,
        chatId,
        data
      );

      const { members } = await client.role.findUnique({
        where: { id: role.id },
        select: { members: { select: { user: { select: { id: true } } } } },
      });

      const toMatchObject = {
        chatId,
        id: expect.any(String),
        name: "default_role",
        roleLevel: null,
        isDefaultRole: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        permissions: expect.any(Array),
      };

      expect(updatedRole).not.toHaveProperty("pk");
      expect(updatedRole).toMatchObject(toMatchObject);
      expect(members[0].user.id).toBe(userId);

      await client.role.delete({ where: { id: updatedRole.id } });
    });

    it("insert a list of member and return the updated object", async () => {
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
        memberIds: [userId],
      };

      const updatedRole = await roleRepository.updateChatRoleMembers(
        role.id,
        chatId,
        data
      );

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
        updatedAt: expect.any(Date),
        permissions: expect.any(Array),
      };

      expect(updatedRole).not.toHaveProperty("pk");
      expect(updatedRole).toMatchObject(toMatchObject);
      expect(members[0].user.id).toBe(userId);

      await client.role.delete({ where: { id: updatedRole.id } });
    });

    it("removes a member and return the updated object", async () => {
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
        memberIds: [userId],
      };

      await roleRepository.updateChatRoleMembers(role.id, chatId, data);

      const updatedRole = await roleRepository.deleteChatRoleMemberById(
        role.id,
        chatId,
        userId
      );

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
        updatedAt: expect.any(Date),
        permissions: expect.any(Array),
      };

      expect(updatedRole).not.toHaveProperty("pk");
      expect(updatedRole).toMatchObject(toMatchObject);
      expect(members).toHaveLength(0);

      await client.role.delete({ where: { id: updatedRole.id } });
    });
  });

  describe("Update permission", () => {
    it("returns the updated object", async () => {
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

      const updatedRole = await roleRepository.updateChatRoleMetaData(role.id, {
        permissions,
      });

      const toMatchObject = {
        chatId,
        id: expect.any(String),
        name: "test_role_3",
        roleLevel: 3,
        isDefaultRole: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        permissions: expect.any(Array),
      };

      const toEqual = expect.arrayContaining(
        permissions.map((perm) => expect.objectContaining({ name: perm }))
      );

      expect(updatedRole).not.toHaveProperty("pk");
      expect(updatedRole).toMatchObject(toMatchObject);
      expect(updatedRole.permissions).toEqual(toEqual);

      await client.role.delete({ where: { id: updatedRole.id } });
    });
  });

  describe("Update role level", () => {
    const chatId = idGenerator();
    const roles = [];

    beforeAll(async () => {
      await client.chat.create({
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
      });

      const roleSize = 100;
      let index = 0;

      while (roleSize > index) {
        roles.push(
          await roleRepository.insert({
            chatId,
            name: `role_${(index += 1)}`,
            isDefaultRole: false,
          })
        );
      }

      return async () => client.chat.delete({ where: { id: chatId } });
    });

    beforeEach(async () => {
      await client.role.updateMany({
        where: {
          chat: { id: chatId },
        },
        data: {
          roleLevel: null,
        },
      });

      await Promise.all(
        roles.map(async (role) =>
          client.role.update({
            where: { id: role.id },
            data: { roleLevel: role.roleLevel },
          })
        )
      );
    });

    it("reorders role levels using input [100, 1], shifting 100 to 1 and adjusting adjacent levels", async () => {
      const rolesToUpdate = await client.role.findMany({
        orderBy: {
          roleLevel: "desc",
        },
        where: {
          chat: {
            id: chatId,
          },
          roleLevel: {
            in: [1, 100],
          },
        },
        select: {
          id: true,
        },
      });

      const oldRole = await client.role.findFirst({
        where: { chat: { id: chatId }, roleLevel: 99 },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const roleIds = rolesToUpdate.map(({ id }) => id);

      const updatedRoles = await roleRepository.updateChatRoleRoleLevels(
        chatId,
        { roleIds }
      );

      const expectedUpdatedRoles = expect.arrayContaining([
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_100",
          roleLevel: 1,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_1",
          roleLevel: 2,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
      ]);

      const newRole = await client.role.findUnique({
        where: { id: oldRole.id },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      expect(updatedRoles).toEqual(expectedUpdatedRoles);
      expect(newRole.roleLevel).toBe(100);
    });

    it("reorders role levels using input [86, 55, 100, 99, 98, 97, 5], adjusting adjacent levels and skipping roles out of range", async () => {
      const rolesToUpdate = await client.role.findMany({
        where: {
          chat: {
            id: chatId,
          },
          roleLevel: {
            in: [86, 55, 100, 99, 98, 97, 5],
          },
        },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const getRolesId = (roles, map = {}, roleIds = []) => {
        if (roles.length === 0) return roleIds;

        const [role, ...rest] = roles;

        const index = map[role.roleLevel];

        if (typeof index === "number") {
          roleIds[index] = role.id;
        }

        return getRolesId(rest, map, roleIds);
      };

      const map = {
        86: 0,
        55: 1,
        100: 2,
        99: 3,
        98: 4,
        97: 5,
        5: 6,
      };

      const roleIds = getRolesId(rolesToUpdate, map);

      const oldRole = await client.role.findFirst({
        where: { chat: { id: chatId }, roleLevel: 96 },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const outOfRangeRoles = await client.role.findMany({
        where: {
          chat: { id: chatId },
          OR: [{ roleLevel: { lt: 5 } }, { roleLevel: { gt: 100 } }],
        },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const updatedRoles = await roleRepository.updateChatRoleRoleLevels(
        chatId,
        { roleIds }
      );

      const expectedUpdatedRoles = expect.arrayContaining([
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_86",
          roleLevel: 5,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),

        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_55",
          roleLevel: 6,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
      ]);

      const newRole = await client.role.findUnique({
        where: { id: oldRole.id },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      expect(updatedRoles).toEqual(expectedUpdatedRoles);
      expect(newRole.roleLevel).toBe(100);
      expect(
        await client.role.findMany({
          where: {
            chat: { id: chatId },
            OR: [{ roleLevel: { lt: 5 } }, { roleLevel: { gt: 100 } }],
          },
          select: {
            id: true,
            roleLevel: true,
          },
        })
      ).toEqual(outOfRangeRoles);
    });

    it("reorders role levels using input [86, 55], adjusting adjacent levels and skipping roles out of range", async () => {
      const rolesToUpdate = await client.role.findMany({
        orderBy: {
          roleLevel: "desc",
        },
        where: {
          chat: {
            id: chatId,
          },
          roleLevel: {
            in: [55, 86],
          },
        },
        select: {
          id: true,
        },
      });

      const roleIds = rolesToUpdate.map(({ id }) => id);

      const oldRole = await client.role.findFirst({
        where: { chat: { id: chatId }, roleLevel: 85 },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const outOfRangeRoles = await client.role.findMany({
        where: {
          chat: { id: chatId },
          OR: [{ roleLevel: { lt: 55 } }, { roleLevel: { gt: 86 } }],
        },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const updatedRoles = await roleRepository.updateChatRoleRoleLevels(
        chatId,
        { roleIds }
      );

      const expectedUpdatedRoles = expect.arrayContaining([
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_86",
          roleLevel: 55,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_55",
          roleLevel: 56,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
      ]);

      const newRole = await client.role.findUnique({
        where: { id: oldRole.id },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      expect(updatedRoles).toEqual(expectedUpdatedRoles);
      expect(newRole.roleLevel).toBe(86);
      expect(
        await client.role.findMany({
          where: {
            chat: { id: chatId },
            OR: [{ roleLevel: { lt: 55 } }, { roleLevel: { gt: 86 } }],
          },
          select: {
            id: true,
            roleLevel: true,
          },
        })
      ).toEqual(outOfRangeRoles);
    });

    it("reorders role levels using input [100, 99, 98, 97, 1] and adjusts adjacent levels", async () => {
      const rolesToUpdate = await client.role.findMany({
        orderBy: {
          roleLevel: "desc",
        },
        where: {
          chat: {
            id: chatId,
          },
          roleLevel: {
            in: [100, 99, 98, 97, 1],
          },
        },
        select: {
          id: true,
        },
      });

      const roleIds = rolesToUpdate.map(({ id }) => id);

      const oldRole = await client.role.findFirst({
        where: { chat: { id: chatId }, roleLevel: 96 },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      const updatedRoles = await roleRepository.updateChatRoleRoleLevels(
        chatId,
        { roleIds }
      );

      const expectedUpdatedRoles = expect.arrayContaining([
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_100",
          roleLevel: 1,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_99",
          roleLevel: 2,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_98",
          roleLevel: 3,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_97",
          roleLevel: 4,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
        expect.objectContaining({
          chatId,
          id: expect.any(String),
          name: "role_1",
          roleLevel: 5,
          isDefaultRole: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          permissions: expect.any(Array),
        }),
      ]);

      const newRole = await client.role.findUnique({
        where: { id: oldRole.id },
        select: {
          id: true,
          roleLevel: true,
        },
      });

      expect(updatedRoles).toEqual(expectedUpdatedRoles);
      expect(newRole.roleLevel).toBe(100);
    });
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
