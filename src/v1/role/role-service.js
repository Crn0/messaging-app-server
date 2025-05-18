import { httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";

// TODO: Implement updateRoleMetaData(chatId: string, roleId: string, data: Partial<Role>)
// - Update role fields such as name, permissions, etc. (exclude level)
// - Ensure chatId and roleId are valid and authorized
// - Validate incoming `data` object (disallow level)
// - Return the updated role or throw an error on failure

const createInsertRole =
  ({ roleRepository, chatService }) =>
  async (DTO) => {
    await chatService.getChatById(DTO.chatId);

    const data = {
      chatId: DTO.chatId,
      name: DTO.name,
      isDefaultRole: false,
    };

    const role = await roleRepository.insertWithTransaction(data);

    return role;
  };

const createInsertDefaultRole =
  ({ roleRepository, chatService, permissionService }) =>
  async (DTO) => {
    await chatService.getChatById(DTO.chatId);

    const permissions = await permissionService.getDefaultPermissions();

    const permissionIds = permissions.map(({ id }) => id);

    const data = {
      permissionIds,
      name: "everyone",
      chatId: DTO.chatId,
      isDefaultRole: true,
    };

    const role = await roleRepository.insert(data);

    return role;
  };

const createGetChatRoleById =
  ({ roleRepository, chatService }) =>
  async (roleId, chatId) => {
    await chatService.getChatById(chatId);

    const role = await roleRepository.findChatRoleById(roleId, chatId);

    if (!role) {
      throw new APIError("Role not found", httpStatus.NOT_FOUND);
    }

    return role;
  };

const createGetChatDefaultRolesById =
  ({ roleRepository, chatService }) =>
  async (chatId) => {
    await chatService.getChatById(chatId);

    const roles = await roleRepository.findChatDefaultRolesById(chatId);

    return roles;
  };

const createGetChatRolesById =
  ({ roleRepository, chatService }) =>
  async (chatId) => {
    await chatService.getChatById(chatId);

    const roles = await roleRepository.findChatRolesById(chatId);

    return roles;
  };

const createGetUserRolesById =
  ({ roleRepository, chatService, userService }) =>
  async (chatId, userId) => {
    await Promise.all([
      chatService.getChatById(chatId),
      userService.getUserById(userId),
    ]);

    const roles = await roleRepository.findUserRolesById(chatId, userId);

    return roles;
  };

const createUpdateChatRoleMetaData =
  ({ roleRepository, chatService }) =>
  async (roleId, chatId, DTO) => {
    await chatService.getChatById(chatId);

    const roleExist = await roleRepository.findChatRoleById(roleId, chatId);

    if (!roleExist) throw new APIError("Role not found", httpStatus.NOT_FOUND);

    const data = {
      name: DTO.name,
      permissionIds: DTO.permissionIds,
    };

    const role = await roleRepository.updateChatRoleMetaData(roleId, data);

    return role;
  };

const createUpdateChatRoleMember =
  ({ roleRepository, chatService }) =>
  async (roleId, chatId, DTO) => {
    await chatService.getMemberById(chatId, DTO.memberId);

    const roleExist = await roleRepository.findChatRoleById(roleId, chatId);

    if (!roleExist) throw new APIError("Role not found", httpStatus.NOT_FOUND);

    const data = {
      memberId: DTO.memberId,
    };

    const role = await roleRepository.updateChatRoleMember(
      roleId,
      chatId,
      data
    );

    return role;
  };

const createUpdateChatRoleMembers =
  ({ roleRepository, chatService }) =>
  async (roleId, chatId, DTO) => {
    await Promise.all(
      DTO.memberIds.map((id) => chatService.getMemberById(chatId, id))
    );

    const data = {
      memberIds: DTO.memberIds,
    };

    const role = await roleRepository.updateChatRoleMembers(
      roleId,
      chatId,
      data
    );

    return role;
  };

const createUpdateChatRolesRoleLevel =
  ({ roleRepository, chatService }) =>
  async (chatId, DTO) => {
    const [_, roleList] = await Promise.all([
      chatService.getChatById(chatId),
      Promise.all(
        DTO.rolesId.map((roleId) =>
          roleRepository.findChatRoleById(roleId, chatId)
        )
      ),
    ]);

    const missingRole = roleList.some((role) => role === null);

    if (missingRole) {
      throw new APIError(
        "One or more roles not found in this chat",
        httpStatus.NOT_FOUND
      );
    }
    const data = {
      rolesId: DTO.rolesId,
    };

    const role = await roleRepository.updateChatRolesRoleLevel(chatId, data);

    return role;
  };

const createDeleteChatRoleMemberById =
  ({ roleRepository, chatService }) =>
  async (chatId, roleId, memberId) => {
    const [_, roleExist] = await Promise.all([
      chatService.getChatById(chatId),
      roleRepository.findChatRoleById(roleId, chatId),
      chatService.getMemberById(chatId, memberId),
    ]);

    if (!roleExist) {
      throw new APIError("Role not found", httpStatus.NOT_FOUND);
    }

    return roleRepository.deleteChatRoleMemberById(roleId, chatId, memberId);
  };

const createDeleteChatRoleById =
  ({ roleRepository, chatService }) =>
  async (roleId, chatId) => {
    const [_, roleExist] = await Promise.all([
      chatService.getChatById(chatId),
      roleRepository.findChatRoleById(roleId, chatId),
    ]);

    if (!roleExist) {
      throw new APIError("Role not found", httpStatus.NOT_FOUND);
    }

    return roleRepository.deleteChatRoleById(roleId, chatId);
  };

export default (dependencies) => {
  const createRole = createInsertRole(dependencies);
  const createDefaultRole = createInsertDefaultRole(dependencies);

  const getChatRoleById = createGetChatRoleById(dependencies);
  const getChatDefaultRolesById = createGetChatDefaultRolesById(dependencies);
  const getChatRolesById = createGetChatRolesById(dependencies);
  const getUserRolesById = createGetUserRolesById(dependencies);

  const updateChatRoleMetaData = createUpdateChatRoleMetaData(dependencies);
  const updateChatRoleMember = createUpdateChatRoleMember(dependencies);
  const updateChatRoleMembers = createUpdateChatRoleMembers(dependencies);
  const updateChatRolesRoleLevel = createUpdateChatRolesRoleLevel(dependencies);

  const deleteChatRoleMemberById = createDeleteChatRoleMemberById(dependencies);
  const deleteChatRoleById = createDeleteChatRoleById(dependencies);

  return Object.freeze({
    createRole,
    createDefaultRole,
    getChatRoleById,
    getChatDefaultRolesById,
    getChatRolesById,
    getUserRolesById,
    updateChatRoleMetaData,
    updateChatRoleMember,
    updateChatRoleMembers,
    updateChatRolesRoleLevel,
    deleteChatRoleMemberById,
    deleteChatRoleById,
  });
};
