const DATA_ACTIONS = {
  INSERT: "insert",
  UPDATE_META_DATA: "update:metaData",
  UPDATE_MEMBER: "update:member",
  UPDATE_MEMBERS: "update:members",
  UPDATE_ROLE_LEVEL: "update:roleLevel",
};

const toData = (action, DTO) => {
  switch (action) {
    case DATA_ACTIONS.INSERT: {
      return {
        name: DTO.name,
        roleLevel: DTO.isDefaultRole ? null : DTO.roleLevel,
        isDefaultRole: DTO.isDefaultRole,
        chat: {
          connect: {
            id: DTO.chatId,
          },
        },
        permissions: {
          connect: DTO.permissionIds?.map?.((id) => ({ id })),
        },
      };
    }
    case DATA_ACTIONS.UPDATE_META_DATA: {
      const data = {};

      if (DTO.name) {
        data.name = DTO.name;
      }

      if (Array.isArray(DTO.permissionIds) && DTO.permissionIds.length > 0) {
        data.permissions = {
          set: [],
          connect: DTO.permissionIds.map((id) => ({ id })),
        };
      }

      return data;
    }
    case DATA_ACTIONS.UPDATE_MEMBER: {
      return {
        members: {
          connect: {
            id: DTO.memberId,
          },
        },
      };
    }
    case DATA_ACTIONS.UPDATE_MEMBERS: {
      return {
        members: {
          set: [],
          connect: DTO.membersId.map((id) => ({ id })),
        },
      };
    }
    case DATA_ACTIONS.UPDATE_ROLE_LEVEL: {
      return {
        roleLevel: DTO.roleLevel,
      };
    }
    default: {
      throw new Error(`Invalid action: ${action}`);
    }
  }
};

const toEntity = (entity) => {
  if (!entity) return null;

  return {
    id: entity.id,
    name: entity.name,
    roleLevel: entity.roleLevel,
    isDefaultRole: entity.isDefaultRole,
    chatId: entity.chat.id,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    permissions: entity.permissions.map(({ id, name }) => ({ id, name })) ?? [],
  };
};

export { toData, toEntity };
