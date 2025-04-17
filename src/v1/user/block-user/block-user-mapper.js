const toData = (action, dataDTO) => {
  if (action === "block:user") {
    return {
      blockedUsers: {
        connect: {
          id: dataDTO.id,
        },
      },
    };
  }

  if (action === "remove:friend") {
    return {
      friends: {
        disconnect: {
          id: dataDTO.id,
        },
      },
      friendsOf: {
        disconnect: {
          id: dataDTO.id,
        },
      },
    };
  }

  throw new Error(`Invalid "action" of ${action}`);
};

const toEntity = (entity) => ({
  id: entity.id,
  blockedUsers: entity?.blockedUsers?.map?.((user) => ({ id: user.id })) ?? [],
  blockedBy: entity?.blockedBy?.map?.((user) => ({ id: user.id })) ?? [],
});

export { toData, toEntity };
