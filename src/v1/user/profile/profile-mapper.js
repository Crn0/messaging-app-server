const toData = (action, dataDTO) => {
  const data = {};

  if (action === "update:displayName") {
    data.displayName = dataDTO.displayName;

    return {
      displayName: data.displayName,
    };
  }

  if (action === "update:aboutMe") {
    data.aboutMe = dataDTO.aboutMe;
    return {
      aboutMe: data.aboutMe,
    };
  }

  if (action === "update:profileAvatar") {
    const images = dataDTO.images.map((image) => ({
      url: image.secure_url,
      format: image.format,
      size: image.bytes,
    }));

    return {
      avatar: {
        upsert: {
          where: {
            id: dataDTO.profileAvatarId,
          },
          update: {
            id: dataDTO.id,
            name: dataDTO.fileName,
            url: dataDTO.url,
            images: {
              deleteMany: {},
              create: images,
            },
            size: dataDTO.size,
            updatedAt: new Date(),
          },
          create: {
            id: dataDTO.id,
            name: dataDTO.fileName,
            url: dataDTO.url,
            images: {
              create: images,
            },
            size: dataDTO.size,
            type: "Image",
          },
        },
      },
    };
  }

  if (action === "update:backgroundAvatar") {
    const images = dataDTO.images.map((image) => ({
      url: image.secure_url,
      format: image.format,
      size: image.bytes,
    }));

    return {
      backgroundAvatar: {
        upsert: {
          where: {
            id: dataDTO.backgroundAvatarId,
          },
          update: {
            id: dataDTO.id,
            name: dataDTO.fileName,
            url: dataDTO.url,
            images: {
              deleteMany: {},
              create: images,
            },
            size: dataDTO.size,
            updatedAt: new Date(),
          },
          create: {
            id: dataDTO.id,
            name: dataDTO.fileName,
            url: dataDTO.url,
            images: {
              create: images,
            },
            size: dataDTO.size,
            type: "Image",
          },
        },
      },
    };
  }

  if (action === "delete:profileAvatar") {
    return {
      avatar: {
        delete: true,
      },
    };
  }

  if (action === "delete:backgroundAvatar") {
    return {
      backgroundAvatar: {
        delete: true,
      },
    };
  }

  throw new Error(`Invalid action: ${action}`);
};

const toEntity = (entity) => {};

export { toData, toEntity };
