const ACTIONS = {
  INSERT: "insert",
  UPDATE_NAME: "update:name",
};

const toData = (action, DTO) => {
  switch (action) {
    case ACTIONS.INSERT: {
      return { name: DTO.name };
    }
    case ACTIONS.UPDATE_NAME: {
      return { name: DTO.name, updatedAt: new Date() };
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
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export { toData, toEntity };
