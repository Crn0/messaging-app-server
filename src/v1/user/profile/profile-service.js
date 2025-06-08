import { env, httpStatus } from "../../../constants/index.js";
import eager from "./eager.js";
import APIError from "../../../errors/api-error.js";

const TRANSACTION_MAX_TIMEOUT = 10_000;

const createUpdateProfileByUserId =
  ({ profileRepository, storage }) =>
  async (userId, DTO) => {
    let avatarAsset;
    let backgroundAvatarAsset;

    const data = {
      displayName: DTO?.displayName,
      aboutMe: DTO?.aboutMe,
      updatedAt: new Date(),
    };

    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${userId}`;

    return profileRepository.transaction(
      async (tx) => {
        try {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { pk: true },
          });

          if (!user) throw new APIError("User not found", httpStatus.NOT_FOUND);

          const profile = await tx.profile.findUnique({
            where: { userPk: user.pk },
            include: {
              avatar: {
                select: {
                  id: true,
                  images: { select: { url: true, format: true, size: true } },
                },
              },
              backgroundAvatar: {
                select: {
                  id: true,
                  images: { select: { url: true, format: true, size: true } },
                },
              },
            },
          });

          const avatarId = profile.avatar?.id;
          const backgroundAvatarId = profile.backgroundAvatar?.id;

          if (DTO?.avatar) {
            if (avatarId) {
              avatarAsset = await storage.update(
                DTO?.path,
                avatarId,
                eager.avatar
              );
            } else {
              avatarAsset = await storage.upload(
                folder,
                DTO?.avatar.path,
                DTO?.avatar.mimetype,
                eager.avatar
              );
            }
          }

          if (DTO?.backgroundAvatar) {
            if (backgroundAvatarId) {
              backgroundAvatarAsset = await storage.update(
                DTO?.backgroundAvatar.path,
                backgroundAvatarId,
                eager.backgroundAvatar
              );
            } else {
              backgroundAvatarAsset = await storage.upload(
                folder,
                DTO?.backgroundAvatar.path,
                DTO?.backgroundAvatar.mimetype,
                eager.backgroundAvatar
              );
            }
          }

          if (avatarAsset) {
            const {
              public_id: id,
              secure_url: url,
              eager: images,
              bytes: size,
              original_filename: fileName,
            } = avatarAsset;

            avatarAsset = {
              id,
              url,
              size,
              fileName,
              images: images.map((image) => ({
                url: image.secure_url,
                format: image.format,
                size: image.bytes,
              })),
            };

            data.avatar = {
              upsert: {
                where: {
                  id: avatarAsset.id,
                },
                update: {
                  id: avatarAsset.id,
                  name: avatarAsset.fileName,
                  url: avatarAsset.url,
                  images: {
                    deleteMany: {},
                    create: avatarAsset.images,
                  },
                  size: avatarAsset.size,
                  updatedAt: new Date(),
                },
                create: {
                  id: avatarAsset.id,
                  name: avatarAsset.fileName,
                  url: avatarAsset.url,
                  images: {
                    create: avatarAsset.images,
                  },
                  size: avatarAsset.size,
                  type: "Image",
                },
              },
            };
          }

          if (backgroundAvatarAsset) {
            const {
              public_id: id,
              secure_url: url,
              eager: images,
              bytes: size,
              original_filename: fileName,
            } = backgroundAvatarAsset;

            backgroundAvatarAsset = {
              id,
              url,
              size,
              fileName,
              images: images.map((image) => ({
                url: image.secure_url,
                format: image.format,
                size: image.bytes,
              })),
            };

            data.backgroundAvatar = {
              upsert: {
                where: {
                  id: backgroundAvatarAsset.id,
                },
                update: {
                  id: backgroundAvatarAsset.id,
                  name: backgroundAvatarAsset.fileName,
                  url: backgroundAvatarAsset.url,
                  images: {
                    deleteMany: {},
                    create: backgroundAvatarAsset.images,
                  },
                  size: backgroundAvatarAsset.size,
                  updatedAt: new Date(),
                },
                create: {
                  id: backgroundAvatarAsset.id,
                  name: backgroundAvatarAsset.fileName,
                  url: backgroundAvatarAsset.url,
                  images: {
                    create: backgroundAvatarAsset.images,
                  },
                  size: backgroundAvatarAsset.size,
                  type: "Image",
                },
              },
            };
          }

          return await tx.profile.update({
            data,
            where: {
              id: profile.id,
            },
          });
        } catch (e) {
          const assetIds = [avatarAsset?.id, backgroundAvatarAsset?.id].filter(
            Boolean
          );

          await Promise.allSettled(
            assetIds.map(async (id) => storage.destroyFile(id, "image"))
          );

          throw e;
        }
      },
      { timeout: TRANSACTION_MAX_TIMEOUT }
    );
  };

const createUpdateDisplayNameByUserId =
  ({ profileRepository, userService }) =>
  async ({ userId, displayName }) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }
    const data = { userPk, displayName };

    const profile = await profileRepository.updateDisplayNameByUserPk(data);

    return profile;
  };

const createUpdateAboutMeByUserId =
  ({ profileRepository, userService }) =>
  async ({ userId, aboutMe }) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const data = { userPk, aboutMe };

    const profile = await profileRepository.updateAboutMeByUserPk(data);

    return profile;
  };

const createUpdateProfileAvatarByUserId =
  ({ profileRepository, userService, storage }) =>
  async ({ userId, file }) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    let attachment;

    const prevProfile = await profileRepository.findProfileByUserPk(userPk);

    const prevAvatarId = prevProfile?.avatar?.id;

    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${userId}`;

    const avatarEagerOptions = [
      // High-resolution display (WebP)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "face" },
          { radius: "max" }, // Circular crop
          { quality: "auto:best", fetch_format: "webp" },
        ],
      },
      // Tiny thumbnail
      {
        transformation: [
          { width: 64, height: 64, crop: "thumb", gravity: "face" },
          { radius: "max" },
          { quality: "auto:low", fetch_format: "webp" },
        ],
      },
      // Fallback (JPG for older browsers)
      {
        transformation: [
          { width: 256, height: 256, crop: "thumb", gravity: "face" },
          { radius: "max" },
          { quality: 80, fetch_format: "jpg" },
        ],
      },
    ];

    if (prevAvatarId) {
      attachment = await storage.update(
        file.path,
        prevAvatarId,
        avatarEagerOptions
      );
    } else {
      attachment = await storage.upload(
        folder,
        file.path,
        file.mimetype,
        avatarEagerOptions
      );
    }

    const {
      public_id: avatarId,
      secure_url: url,
      eager: images,
      bytes: size,
      original_filename: fileName,
    } = attachment;

    const data = {
      userPk,
      avatarId,
      url,
      images,
      fileName,
      size,
      id: avatarId,
    };

    const profile = await profileRepository.updateAvatarByUserPk(data);

    return profile;
  };

const createUpdateBackgroundAvatarByUserId =
  ({ profileRepository, userService, storage }) =>
  async ({ userId, file }) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    let attachment;

    const prevProfile = await profileRepository.findProfileByUserPk(userPk);

    const backgroundAvatar = prevProfile?.backgroundAvatar?.id;
    const prevPublicId = prevProfile.backgroundAvatar?.id;

    const folder = `${env.CLOUDINARY_ROOT_NAME}/avatars/${userId}`;

    const avatarEagerOptions = [
      // Main profile display (webp for best quality/size ratio)
      {
        transformation: [
          { width: 600, height: 240, crop: "fill" },
          { quality: "auto", fetch_format: "webp" },
        ],
      },

      // Blurred background effect
      {
        transformation: [
          { width: 800, height: 320, crop: "fill" },
          { effect: "blur:1000" },
          { quality: 30, fetch_format: "webp" }, // Low quality for blurred
        ],
      },
    ];

    if (prevPublicId) {
      attachment = await storage.update(
        file.path,
        prevPublicId,
        avatarEagerOptions
      );
    } else {
      attachment = await storage.upload(
        folder,
        file.path,
        file.mimetype,
        avatarEagerOptions
      );
    }

    const {
      public_id: id,
      secure_url: url,
      eager: images,

      bytes: size,
      original_filename: fileName,
    } = attachment;

    const data = {
      userPk,
      backgroundAvatar,
      id,
      images,
      fileName,
      url,
      size,
    };

    const profile =
      await profileRepository.updateBackgroundAvatarByUserPk(data);

    return profile;
  };

const createDeleteProfileAvatarByUserId =
  ({ profileRepository, userService, storage }) =>
  async (userId) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const profile = await profileRepository.findProfileByUserPk(userPk);

    if (profile.avatar === null) {
      throw new APIError("No avatar found", httpStatus.NOT_FOUND);
    }

    await storage.destroyFile(profile.avatar.id, "Image");

    return profileRepository.deleteAvatarByUserPk(userPk);
  };

const createDeleteBackgroundAvatarByUserId =
  ({ profileRepository, userService, storage }) =>
  async (userId) => {
    const userPk = await userService.getUserPkById(userId);

    if (!userPk) {
      throw new APIError("User not found", httpStatus.NOT_FOUND);
    }

    const profile = await profileRepository.findProfileByUserPk(userPk);

    if (profile.backgroundAvatar === null) {
      throw new APIError("No background avatar found", httpStatus.NOT_FOUND);
    }

    await storage.destroyFile(profile.backgroundAvatar.id, "Image");

    return profileRepository.deleteBackgroundAvatarByUserPk(userPk);
  };

export default (dependencies) => {
  const updateProfileByUserId = createUpdateProfileByUserId(dependencies);

  const updateDisplayNameByUserId =
    createUpdateDisplayNameByUserId(dependencies);
  const updateAboutMeByUserId = createUpdateAboutMeByUserId(dependencies);

  const updateProfileAvatarByUserId =
    createUpdateProfileAvatarByUserId(dependencies);

  const updateBackgroundAvatarByUserId =
    createUpdateBackgroundAvatarByUserId(dependencies);

  const deleteProfileAvatarByUserId =
    createDeleteProfileAvatarByUserId(dependencies);

  const deleteBackgroundAvatarByUserId =
    createDeleteBackgroundAvatarByUserId(dependencies);

  return Object.freeze({
    updateProfileByUserId,
    updateDisplayNameByUserId,
    updateAboutMeByUserId,
    updateProfileAvatarByUserId,
    updateBackgroundAvatarByUserId,
    deleteProfileAvatarByUserId,
    deleteBackgroundAvatarByUserId,
  });
};

export {
  createDeleteProfileAvatarByUserId,
  createDeleteBackgroundAvatarByUserId,
};
