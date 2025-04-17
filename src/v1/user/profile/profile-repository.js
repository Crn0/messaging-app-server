import client from "../../../db/client.js";
import { toData } from "./profile-mapper.js";

const findProfileByUserPk = async (userPk) => {
  const profile = await client.profile.findUnique({
    where: { userPk },
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

  return profile;
};

const updateDisplayNameByUserPk = async ({ userPk, displayName }) => {
  const data = toData("update:displayName", { displayName });

  const profile = await client.profile.update({ data, where: { userPk } });

  return profile;
};

const updateAboutMeByUserPk = async ({ userPk, aboutMe }) => {
  const data = toData("update:aboutMe", { aboutMe });

  const profile = await client.profile.update({ data, where: { userPk } });

  return profile;
};

const updateAvatarByUserPk = async ({
  userPk,
  profileAvatarId,
  id,
  fileName,
  url,
  images,
  size,
}) => {
  const data = toData("update:profileAvatar", {
    profileAvatarId,
    id,
    fileName,
    url,
    images,
    size,
    type: "profileAvatar",
  });

  const profile = await client.profile.update({
    data,
    where: { userPk },
    include: {
      avatar: {
        select: {
          url: true,
          images: { select: { url: true, format: true, size: true } },
        },
      },
    },
  });

  return profile;
};

const updateBackgroundAvatarByUserPk = async ({
  userPk,
  backgroundAvatarId,
  id,
  url,
  fileName,
  images,

  size,
}) => {
  const data = toData("update:backgroundAvatar", {
    backgroundAvatarId,
    id,
    url,
    fileName,
    images,
    size,
  });

  const profile = await client.profile.update({
    data,
    where: { userPk },
    include: {
      backgroundAvatar: {
        select: {
          url: true,
          images: { select: { url: true, format: true, size: true } },
        },
      },
    },
  });

  return profile;
};

const deleteAvatarByUserPk = async (userPk) => {
  const data = toData("delete:profileAvatar");

  const profile = await client.profile.update({
    data,
    where: { userPk },
    include: {
      avatar: {
        select: {
          url: true,
          images: { select: { url: true, format: true, size: true } },
        },
      },
    },
  });

  return profile;
};

const deleteBackgroundAvatarByUserPk = async (userPk) => {
  const data = toData("delete:backgroundAvatar");

  const profile = await client.profile.update({
    data,
    where: { userPk },
    include: {
      backgroundAvatar: {
        select: {
          url: true,
          images: { select: { url: true, format: true, size: true } },
        },
      },
    },
  });

  return profile;
};

export default {
  findProfileByUserPk,
  updateDisplayNameByUserPk,
  updateAboutMeByUserPk,
  updateAvatarByUserPk,
  updateBackgroundAvatarByUserPk,
  deleteAvatarByUserPk,
  deleteBackgroundAvatarByUserPk,
};
