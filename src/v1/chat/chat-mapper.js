const CHAT_TYPES = {
  DIRECT: "DirectChat",
  GROUP: "GroupChat",
};

const ENTITY_TYPES = {
  CHAT: "Chat",
  MESSAGE: "Message",
  MEMBER: "Member",
};

const DIRECT_CHAT_ACTIONS = {
  INSERT: "insert",
  UPDATE_MEMBER: "update:member",
  UPDATE_MEMBER_MUTED_UNTIL: "update:member:mutedUntil",
};

const GROUP_CHAT_ACTIONS = {
  INSERT: "insert",
  UPDATE_NAME: "update:name",
  UPSERT_AVATAR: "upsert:avatar",
  UPDATE_MEMBER: "update:member",
  UPDATE_MEMBER_MUTED_UNTIL: "update:member:mutedUntil",
  DELETE_MEMBER: "delete:member",
};

const MESSAGES_ACTIONS = {
  CREATE_MESSAGE: "insert:message",
  UPDATE_MESSAGE_ATTACHMENT: "update:message:attachment",
  UPDATE_MESSAGE_REPLY: "update:message:reply",
  UPDATE_MESSAGE_DELETED_AT: "update:message:deletedAt",
};

const directChatData = (action, DTO) => {
  switch (action) {
    case DIRECT_CHAT_ACTIONS.INSERT: {
      return {
        type: CHAT_TYPES.DIRECT,
        isPrivate: true,
        members: {
          create: DTO.userPks.map((userPk) => ({ userPk })),
        },
      };
    }
    case DIRECT_CHAT_ACTIONS.UPDATE_MEMBER: {
      return {
        members: {
          create: {
            userPk: DTO.userPk,
          },
        },
      };
    }
    case DIRECT_CHAT_ACTIONS.UPDATE_MEMBER_MUTED_UNTIL: {
      return {
        mutedUntil: DTO.mutedUntil,
      };
    }
    default: {
      throw new Error(`Invalid action: ${action}`);
    }
  }
};

const groupChatData = (action, DTO) => {
  switch (action) {
    case GROUP_CHAT_ACTIONS.INSERT: {
      const id = DTO.attachment?.id;
      const name = DTO.attachment?.name;
      const url = DTO.attachment?.url;
      const size = DTO.attachment?.size;
      const images = DTO.attachment?.images;

      const data = {
        id: DTO.chatId,
        name: DTO.name,
        type: CHAT_TYPES.GROUP,
        isPrivate: DTO.isPrivate,
        ownerPk: DTO.ownerPk,
        members: {
          create: {
            userPk: DTO.ownerPk,
          },
        },
      };

      if (id) {
        data.avatar = {
          create: {
            id,
            name,
            url,
            size,
            type: "Image",
            images: {
              create: images,
            },
          },
        };
      }

      return data;
    }
    case GROUP_CHAT_ACTIONS.UPDATE_MEMBER:
      return {
        members: {
          create: {
            userPk: DTO.userPk,
          },
        },
      };
    case GROUP_CHAT_ACTIONS.UPDATE_NAME: {
      return {
        name: DTO.name,
        updatedAt: new Date(),
      };
    }
    case GROUP_CHAT_ACTIONS.UPSERT_AVATAR: {
      const { id, name, url, size, images } = DTO.attachment;

      return {
        updatedAt: new Date(),
        avatar: {
          upsert: {
            where: {
              id,
            },
            update: {
              id,
              name,
              url,
              images: {
                deleteMany: {},
                create: images,
              },
              size,
              updatedAt: new Date(),
            },
            create: {
              id,
              name,
              url,
              images: {
                create: images,
              },
              size,
              type: "Image",
            },
          },
        },
      };
    }
    case GROUP_CHAT_ACTIONS.UPDATE_MEMBER_MUTED_UNTIL: {
      return {
        mutedUntil: DTO.mutedUntil,
      };
    }
    case GROUP_CHAT_ACTIONS.DELETE_MEMBER:
      return {
        members: {
          delete: { id: DTO.userOnChatId },
        },
      };
    default:
      throw new Error(`Invalid action: ${action}`);
  }
};

const chatActionData = (action, DTO) => {
  switch (DTO.type) {
    case CHAT_TYPES.DIRECT:
      return directChatData(action, DTO);
    case CHAT_TYPES.GROUP:
      return groupChatData(action, DTO);
    default:
      throw new Error(`Invalid type: ${DTO.type}`);
  }
};

const messagesAction = (action, DTO) => {
  switch (action) {
    case MESSAGES_ACTIONS.CREATE_MESSAGE: {
      return {
        content: DTO.content,

        chat: {
          connect: {
            id: DTO.chatId,
          },
        },
        user: {
          connect: {
            id: DTO.senderId,
          },
        },
      };
    }
    case MESSAGES_ACTIONS.UPDATE_MESSAGE_REPLY: {
      return {
        content: DTO.content,
        replyTo: {
          connect: {
            id: DTO.messageId,
          },
        },
        chat: {
          connect: {
            id: DTO.chatId,
          },
        },
        user: {
          connect: {
            id: DTO.senderId,
          },
        },
      };
    }
    case MESSAGES_ACTIONS.UPDATE_MESSAGE_ATTACHMENT: {
      const { id, name, url, size, type, images: assets } = DTO.attachment;

      let format = "Image";

      if (type === "epub") {
        format = "Epub";
      }

      if (type === "pdf") {
        format = "Pdf";
      }

      if (type === "epub" || type === "pdf") {
        return {
          id,
          name,
          url,
          size,
          type: format,
          chat: {
            connect: {
              id: DTO.chatId,
            },
          },
          message: {
            connect: {
              id: DTO.messageId,
            },
          },
        };
      }

      const images = assets?.map((asset) => ({
        url: asset.url,
        format: asset.format,
        size: asset?.size,
      }));

      return {
        id,
        name,
        url,
        size,
        type: format,
        images: {
          create: images,
        },
        chat: {
          connect: {
            id: DTO.chatId,
          },
        },
        message: {
          connect: {
            id: DTO.messageId,
          },
        },
      };
    }
    case MESSAGES_ACTIONS.UPDATE_MESSAGE_DELETED_AT: {
      return {
        content: DTO.content,
        deletedAt: new Date(),
        attachments: {
          deleteMany: {},
        },
      };
    }

    default: {
      throw new Error(`Invalid action: ${action}`);
    }
  }
};

const toData = (action, DTO) => {
  if (
    Object.values(DIRECT_CHAT_ACTIONS).includes(action) ||
    Object.values(GROUP_CHAT_ACTIONS).includes(action)
  ) {
    return chatActionData(action, DTO);
  }

  if (Object.values(MESSAGES_ACTIONS).includes(action)) {
    return messagesAction(action, DTO);
  }

  throw new Error(`Invalid action: ${action}`);
};

const toImage = (entity) => {
  if (!entity) return null;

  const { url, size, format } = entity;

  return { url, size, format };
};

const toAttachment = (entity) => {
  if (!entity) return null;

  const { id, name, url, size, createdAt, updatedAt, images } = entity;

  return {
    id,
    name,
    url,
    size,
    createdAt,
    updatedAt,
    images: images.map(toImage),
  };
};

const toMessage = (entity, depth = 0) => {
  if (!entity) return null;

  const {
    id,
    content,
    createdAt,
    updatedAt,
    deletedAt,
    user,
    chat,
    replies,
    replyTo,
    attachments,
  } = entity;

  if (depth > 0) {
    return {
      id,
      content,
      createdAt,
      updatedAt,
      user,
      deletedAt,
      chatId: chat?.id,
      attachments: attachments?.map?.(toAttachment) ?? [],
    };
  }

  const parentMessage = toMessage(replyTo, depth + 1);

  return {
    id,
    content,
    createdAt,
    updatedAt,
    user,
    deletedAt,
    replies: replies?.map?.(toMessage) ?? [],
    replyTo: parentMessage,
    chatId: chat?.id,
    attachments: attachments?.map?.(toAttachment) ?? [],
  };
};

const toMember = (entity) => {
  if (entity === null) return null;

  const { user, mutedUntil, joinedAt, roles } = entity;

  return {
    ...user,
    serverProfile: {
      mutedUntil,
      joinedAt,
      roles,
    },
  };
};

const toChat = (entity, context) => {
  if (entity === null) return null;

  const {
    id,
    name,
    avatar,
    isPrivate,
    createdAt,
    updatedAt,
    type,
    owner,
    members,
    roles,
  } = entity;

  if (avatar) {
    delete avatar.pk;
    delete avatar.chatPk;
    delete avatar.chatAvatarPk;
    delete avatar.profileAvatarPk;
    delete avatar.profileBackgroundAvatarPk;
    delete avatar.messagePk;
  }

  const data = {
    id,
    name,
    isPrivate,
    createdAt,
    updatedAt,
    type,
    avatar: avatar ?? null,
    //  members: members?.length ? members.map(({ user }) => user.id) : [],
  };

  if (owner) {
    data.ownerId = owner.id;
  }

  if (members?.length) {
    data.members = members.map(({ user }) => user.id);
  }

  if (roles?.length) {
    data.roles = roles;
  }

  if (type === "DirectChat") {
    if (members?.length) {
      data.tempAvatars = members.map(({ user }) => ({
        id: user.id,
        avatar: user?.profile?.avatar ?? null,
      }));
    }
  }

  return data;
};

const toEntity = (entityType, entity, context) => {
  switch (entityType) {
    case ENTITY_TYPES.CHAT: {
      return toChat(entity, context);
    }
    case ENTITY_TYPES.MEMBER: {
      return toMember(entity);
    }
    case ENTITY_TYPES.MESSAGE: {
      return toMessage(entity);
    }
    default: {
      throw new Error(`Invalid entity: ${entityType}`);
    }
  }
};

export { toData, toEntity };
