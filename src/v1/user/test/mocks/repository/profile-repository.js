import db from "../db/index.js";

const dbClear = () => {
  db.clear();
};

const findProfileByUserPk = async (userPk) => db.get(userPk);

const updateDisplayNameByUserPk = async ({ userPk, displayName }) => {
  const oldProfile = db.get(userPk);

  const updatedProfile = {
    ...oldProfile,
    profile: {
      ...oldProfile.profile,
      displayName,
    },
    updatedAt: new Date(),
  };

  db.set(userPk, updatedProfile);

  return updatedProfile;
};

const updateAboutMeByUserPk = async ({ userPk, aboutMe }) => {
  const oldProfile = db.get(userPk);

  const updatedProfile = {
    ...oldProfile,
    profile: {
      ...oldProfile.profile,
      aboutMe,
    },
    updatedAt: new Date(),
  };

  db.set(userPk, updatedProfile);

  return updatedProfile;
};

const updateAvatarByUserPk = async ({
  userPk,
  // eslint-disable-next-line no-unused-vars
  profileAvatarId,
  id,
  fileName,
  url,
  images,
  size,
}) => {
  const oldProfile = db.get(userPk);

  const updatedProfile = {
    ...oldProfile,
    updatedAt: new Date(),
    profile: {
      ...oldProfile.profile,
      avatar: {
        id,
        fileName,
        url,
        size,
        images: images.map?.((image) => ({
          url: image.secure_url,
          format: image.format,
          size: image.bytes,
        })),
        type: "Image",
      },
    },
  };

  db.set(userPk, updatedProfile);

  return updatedProfile;
};

const updateBackgroundAvatarByUserPk = async ({
  userPk,
  // eslint-disable-next-line no-unused-vars
  profileAvatarId,
  id,
  fileName,
  url,
  images,
  size,
}) => {
  const oldProfile = db.get(userPk);

  const updatedProfile = {
    ...oldProfile,
    updatedAt: new Date(),
    profile: {
      ...oldProfile.profile,
      backgroundAvatar: {
        id,
        fileName,
        url,
        size,
        images: images.map?.((image) => ({
          url: image.secure_url,
          format: image.format,
          size: image.bytes,
        })),
        type: "Image",
      },
    },
  };

  db.set(userPk, updatedProfile);

  return updatedProfile;
};

export default {
  findProfileByUserPk,
  updateDisplayNameByUserPk,
  updateAboutMeByUserPk,
  updateAvatarByUserPk,
  updateBackgroundAvatarByUserPk,
};

export { dbClear };
