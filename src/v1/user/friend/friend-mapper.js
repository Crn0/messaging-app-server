const chatMapper = (entity) => {
  const chat = {};

  const { id, type, name, avatar } = entity.chat;

  if (id) {
    chat.id = id;
  }

  if (type) {
    chat.type = type;
  }

  if (name || name === null) {
    chat.name = name;
  }

  if (avatar || avatar === null) {
    chat.avatar = avatar !== null ? { ...avatar } : null;
  }

  return chat;
};

const toData = (action, dataDTO) => {
  if (action === "add:friend") {
    return {
      friends: {
        connect: {
          id: dataDTO.id,
        },
      },
      friendsOf: {
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

const toEntity = (entity) => {
  if (entity === null) return null;

  return {
    id: entity.id,
    username: entity.username,
    profile: {
      displayName: entity.profile?.displayName,
      avatar: entity.profile?.avatar,
    },
    friends: entity.friends ?? [],
  };
};

export { toData, toEntity };
