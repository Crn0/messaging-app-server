import { httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";

const DEFAULT_PERMISSIONS = ["send_message", "create_invite", "view_chat"];

const createInsertPermission =
  ({ permissionRepository }) =>
  async (DTO) => {
    const permissionExist = await permissionRepository.findPermissionByName(
      DTO.name
    );

    if (permissionExist) {
      throw new APIError("Permission already exist", httpStatus.CONFLICT);
    }

    const data = {
      name: DTO.name,
    };

    const permssion = await permissionRepository.insert(data);

    return permssion;
  };

const createGetPermissionById =
  ({ permissionRepository }) =>
  async (id) => {
    const permission = await permissionRepository.findPermissionById(id);

    if (permission) {
      throw new APIError("Permission not found", httpStatus.NOT_FOUND);
    }

    return permission;
  };

const createGetPermissionByName =
  ({ permissionRepository }) =>
  async (name) => {
    const permission = await permissionRepository.findPermissionByName(name);

    if (permission) {
      throw new APIError("Permission not found", httpStatus.NOT_FOUND);
    }

    return permission;
  };

const createGetPermissions =
  ({ permissionRepository }) =>
  async () => {
    const permissions = await permissionRepository.findPermissions();

    return permissions;
  };

const createGetDefaultPermissions =
  ({ permissionRepository }) =>
  async () => {
    const filter = {
      where: {
        name: { in: DEFAULT_PERMISSIONS },
      },
    };

    const permissions = await permissionRepository.findPermissions(filter);

    return permissions;
  };

const createDeletePermissionById =
  ({ permissionRepository }) =>
  async (id) => {
    const permissionExist = await permissionRepository.findPermissionById(id);

    if (!permissionExist) {
      throw new APIError("Permission does not exist", httpStatus.NOT_FOUND);
    }

    const deletePermission =
      await permissionRepository.deletePermissionById(id);

    return deletePermission;
  };

const createDeletePermissionByName =
  ({ permissionRepository }) =>
  async (name) => {
    const permissionExist =
      await permissionRepository.findPermissionByName(name);

    if (!permissionExist) {
      throw new APIError("Permission does not exist", httpStatus.NOT_FOUND);
    }

    const deletePermission =
      await permissionRepository.deletePermissionByName(name);

    return deletePermission;
  };

export default (dependencies) => {
  const createPermission = createInsertPermission(dependencies);

  const getPermissionById = createGetPermissionById(dependencies);
  const getPermissionByName = createGetPermissionByName(dependencies);
  const getPermissions = createGetPermissions(dependencies);
  const getDefaultPermissions = createGetDefaultPermissions(dependencies);

  const deletePermissionById = createDeletePermissionById(dependencies);
  const deletePermissionByName = createDeletePermissionByName(dependencies);

  return Object.freeze({
    createPermission,
    getPermissionById,
    getPermissionByName,
    getPermissions,
    getDefaultPermissions,
    deletePermissionById,
    deletePermissionByName,
  });
};

export {
  createGetPermissionById,
  createGetPermissionByName,
  createGetPermissions,
  createGetDefaultPermissions,
};
