const DATA_ACTIONS = {
  INSERT: "insert",
  UPDATE_META_DATA: "update:metaData",
  UPDATE_MEMBER: "update:member",
  UPDATE_MEMBERS: "update:members",
  UPDATE_ROLE_LEVEL: "update:roleLevel",
  DELETE_MEMBER: "delete:member",
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
          connect: DTO.permissions?.map?.((perm) => ({ name: perm })),
        },
      };
    }
    case DATA_ACTIONS.UPDATE_META_DATA: {
      const data = { updatedAt: new Date() };

      if (DTO.name) {
        data.name = DTO.name;
      }

      if (Array.isArray(DTO.permissions) && DTO.permissions.length > 0) {
        data.permissions = {
          set: [],

          connect: DTO.permissions?.map?.((perm) => ({ name: perm })),
        };
      }

      return data;
    }
    case DATA_ACTIONS.UPDATE_MEMBER: {
      return {
        updatedAt: new Date(),
        members: {
          connect: {
            id: DTO.memberId,
          },
        },
      };
    }
    case DATA_ACTIONS.UPDATE_MEMBERS: {
      return {
        updatedAt: new Date(),
        members: {
          connect: DTO.memberIds.map((id) => ({ id })),
        },
      };
    }
    case DATA_ACTIONS.UPDATE_ROLE_LEVEL: {
      return {
        updatedAt: new Date(),
        roleLevel: DTO.roleLevel,
      };
    }
    case DATA_ACTIONS.DELETE_MEMBER: {
      return {
        updatedAt: new Date(),
        members: {
          disconnect: {
            id: DTO.memberId,
          },
        },
      };
    }
    default: {
      throw new Error(`Invalid action: ${action}`);
    }
  }
};

const toEntity = (entity, type) => {
  if (!entity) return null;

  if (type === "me")
    return {
      ...entity,
      permissions:
        entity.permissions.map(({ id, name }) => ({ id, name })) ?? [],
    };

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
