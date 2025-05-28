import { env, httpStatus } from "../../../constants/index.js";
import APIError from "../../../errors/api-error.js";

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
