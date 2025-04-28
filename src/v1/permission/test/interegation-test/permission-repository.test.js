import { describe, it, expect, beforeAll } from "vitest";
import client from "../../../../db/client.js";
import permissionRepository from "../../permission-repository.js";
import permissionsData from "../data/permissions.js";

describe("Permission creation", () => {
  it("creates a permission and returns the created permisson object", async () => {
    const data = {
      name: "test_permission",
    };

    const permission = await permissionRepository.insert(data);

    const toMatchObject = {
      id: expect.any(String),
      name: data.name,
      createdAt: expect.any(Date),
      updatedAt: null,
    };

    expect(permission).toMatchObject(toMatchObject);
    expect(permission).not.toHaveProperty("pk");

    await client.permission.delete({ where: { name: permission.name } });
  });
});

describe("Permission detail", () => {
  let permissionId;

  beforeAll(async () => {
    const [permission] = await client.$transaction([
      client.permission.create({
        data: {
          name: permissionsData[0],
        },
      }),
      client.permission.createMany({
        data: permissionsData
          .slice(1, permissionsData.length)
          .map((name) => ({ name })),
      }),
    ]);

    permissionId = permission.id;

    return async () => {
      await client.permission.deleteMany({
        where: {
          name: { in: permissionsData },
        },
      });
    };
  });

  it("returns the permission object by id", async () => {
    const permission =
      await permissionRepository.findPermissionById(permissionId);

    const toMatchObject = {
      id: expect.any(String),
      name: "manage_roles",
      createdAt: expect.any(Date),
      updatedAt: null,
    };

    expect(permission).toMatchObject(toMatchObject);
    expect(permission).not.toHaveProperty("pk");
  });

  it("returns the permission object by name", async () => {
    const permission =
      await permissionRepository.findPermissionByName("manage_chat");

    const toMatchObject = {
      id: expect.any(String),
      name: "manage_chat",
      createdAt: expect.any(Date),
      updatedAt: null,
    };

    expect(permission).toMatchObject(toMatchObject);
    expect(permission).not.toHaveProperty("pk");
  });

  it("returns a list of permission object", async () => {
    const permissions =
      await permissionRepository.findPermissions("manage_roles");

    const toEqual = expect.arrayContaining(
      permissionsData.map((name) =>
        expect.objectContaining({
          name,
          id: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: null,
        })
      )
    );

    expect(permissions).toHaveLength(permissionsData.length);
    expect(permissions).toEqual(toEqual);
    expect(permissions[0]).not.toHaveProperty("pk");
  });
});

describe("Permission update", () => {
  let permissionId;
  beforeAll(async () => {
    const permission = await client.permission.create({
      data: {
        name: permissionsData[0],
      },
    });

    permissionId = permission.id;

    return async () => {
      await client.permission.delete({
        where: {
          id: permission.id,
        },
      });
    };
  });

  it("updates the permission name by ID and returns the updated permission object", async () => {
    const updatedPermission =
      await permissionRepository.updatePermissionNameById(
        permissionId,
        "updated_name"
      );

    const toMatchObject = {
      id: permissionId,
      name: "updated_name",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    };

    expect(updatedPermission).toMatchObject(toMatchObject);
  });
});

describe("Permission deletion", () => {
  it("deletes the permission by id and returns the deleted permission object", async () => {
    const permission = await client.permission.create({
      data: {
        name: permissionsData[0],
      },
    });

    const { id } = permission;

    const deletedPermission =
      await permissionRepository.deletePermissionById(id);

    const toMatchObject = {
      id,
      name: permissionsData[0],
      createdAt: expect.any(Date),
      updatedAt: null,
    };

    expect(deletedPermission).toMatchObject(toMatchObject);
    expect(await permissionRepository.findPermissionById(id)).toBeNull();
  });

  it("deletes the permission by name and returns the deleted permission object", async () => {
    const permission = await client.permission.create({
      data: {
        name: permissionsData[0],
      },
    });

    const { id, name } = permission;

    const deletedPermission =
      await permissionRepository.deletePermissionByName(name);

    const toMatchObject = {
      id,
      name,
      createdAt: expect.any(Date),
      updatedAt: null,
    };

    expect(deletedPermission).toMatchObject(toMatchObject);
    expect(await permissionRepository.findPermissionByName(name)).toBeNull();
  });
});
