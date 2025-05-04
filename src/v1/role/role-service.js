import { httpStatus } from "../../constants/index.js";
import APIError from "../../errors/api-error.js";

const createInsertRole =
  ({ roleRepository, chatService }) =>
  async (DTO) => {
    await chatService.getChatById(DTO.chatId);

    const data = {
      chatId: DTO.chatId,
      name: DTO.name,
      isDefaultRole: false,
    };

    const role = await roleRepository.insert(data);

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
      throw APIError("Role not found", httpStatus.NOT_FOUND);
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

const createUpdateChatRoleDisplay =
  ({ roleRepository, chatService }) =>
  async (DTO) => {
    await chatService.getChatById(DTO.chatId);

    const data = {
      roleId: DTO.roleId,
      chatId: DTO.chatId,
      name: DTO.name,
    };

    const role = await roleRepository.updateChatRoleDisplay(data);

    return role;
  };

const createUpdateChatRoleMember =
  ({ roleRepository, chatService, userService }) =>
  async (DTO) => {
    await Promise.all([
      chatService.getChatById(DTO.chatId),
      userService.getUserById(DTO.memberId),
    ]);

    const data = {
      roleId: DTO.roleId,
      chatId: DTO.chatId,
      memberId: DTO.memberId,
    };

    const role = await roleRepository.updateChatRolePermissions(data);

    return role;
  };

const createUpdateChatRolePermissions =
  ({ roleRepository, chatService }) =>
  async (DTO) => {
    await chatService.getChatById(DTO.chatId);

    const data = {
      roleId: DTO.roleId,
      chatId: DTO.chatId,
      permissionIds: DTO.permissionIds,
    };

    const role = await roleRepository.updateChatRolePermissions(data);

    return role;
  };

const createUpdateChatRoleMembers =
  ({ roleRepository, chatService, userService }) =>
  async (DTO) => {
    await Promise.all([
      chatService.getChatById(DTO.chatId),
      Promise.all(DTO.membersId.map((id) => userService.getUserById(id))),
    ]);

    const data = {
      roleId: DTO.roleId,
      chatId: DTO.chatId,
      membersId: DTO.membersId,
    };

    const role = await roleRepository.updateChatRoleMembers(data);

    return role;
  };

const createUpdateChatRolesRoleLevel =
  ({ roleRepository, chatService }) =>
  async (DTO) => {
    const [_, roleList] = await Promise.all([
      chatService.getChatById(DTO.chatId),
      Promise.all(
        DTO.rolesId.map((roleId) =>
          roleRepository.findChatRoleById(roleId, DTO.chatId)
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
      roleId: DTO.roleId,
      chatId: DTO.chatId,
      membersId: DTO.membersId,
    };

    const role = await roleRepository.updateChatRolePermissions(data);

    return role;
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

  const updateChatRoleDisplay = createUpdateChatRoleDisplay(dependencies);
  const updateChatRoleMember = createUpdateChatRoleMember(dependencies);
  const updateChatRolePermissions =
    createUpdateChatRolePermissions(dependencies);
  const updateChatRoleMembers = createUpdateChatRoleMembers(dependencies);
  const updateChatRolesRoleLevel = createUpdateChatRolesRoleLevel(dependencies);

  const deleteChatRoleById = createDeleteChatRoleById(dependencies);

  return Object.freeze({
    createRole,
    createDefaultRole,
    getChatRoleById,
    getChatDefaultRolesById,
    getChatRolesById,
    getUserRolesById,
    updateChatRoleDisplay,
    updateChatRoleMember,
    updateChatRolePermissions,
    updateChatRoleMembers,
    updateChatRolesRoleLevel,
    deleteChatRoleById,
  });
};
