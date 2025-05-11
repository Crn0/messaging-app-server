import { idGenerator } from "../../utils.js";

const testId = idGenerator();

const testUser01 = {
  pk: 1,
  id: idGenerator(),
  username: "john_doe",
  email: "john@example.com",
  password: "123456",
  profile: {
    displayName: null,
    aboutMe: null,
    avatar: null,
    backgroundAvatar: null,
  },
};

const testUser02 = {
  pk: 2,
  id: idGenerator(),
  username: "jane_doe",
  email: "jane@example.com",
  password: "123456",
  profile: {
    displayName: null,
    aboutMe: null,
    avatar: null,
    backgroundAvatar: null,
  },
};

const testFile01 = {
  path: "avatar",
  mimetype: "image/jpeg",
};

const testFile02 = {
  path: "backgroundAvatar",
  mimetype: "image/jpeg",
};

const testAvatar01 = {
  asset_id: "fc9b60e2b339c1922301870452e38773",
  public_id:
    "dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef",
  version: 1743843545,
  version_id: "9fabd66deff3177a62a4066757a0911f",
  signature: "879d57027be2877bc7a3dc194ccd9b984157fbf4",
  width: 1075,
  height: 1536,
  format: "jpg",
  resource_type: "image",
  created_at: "2025-04-05T08:59:05Z",
  tags: [],
  pages: 1,
  bytes: 651441,
  type: "upload",
  etag: "729f4ba67cbbb3f79d96458aff90efe3",
  placeholder: false,
  url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.jpg",
  secure_url:
    "https://res.cloudinary.com/dhtzg8kkq/image/upload/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.jpg",
  asset_folder: "dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521",
  display_name: "avatar-d574547ce950f7d0111c_qj1uef",
  overwritten: true,
  coordinates: { faces: [] },
  original_filename: "avatar-26ac7715e5d831981d38",
  original_extension: "jpeg",
  eager: [
    {
      transformation: "c_thumb,g_face,h_256,w_256/r_max/f_webp,q_auto:best",
      width: 256,
      height: 256,
      bytes: 21150,
      format: "webp",
      url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_256,w_256/r_max/f_webp,q_auto:best/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.webp",
      secure_url:
        "https://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_256,w_256/r_max/f_webp,q_auto:best/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.webp",
    },
    {
      transformation: "c_thumb,g_face,h_64,w_64/r_max/f_webp,q_auto:low",
      width: 64,
      height: 64,
      bytes: 1660,
      format: "webp",
      url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_64,w_64/r_max/f_webp,q_auto:low/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.webp",
      secure_url:
        "https://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_64,w_64/r_max/f_webp,q_auto:low/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.webp",
    },
    {
      transformation: "c_thumb,g_face,h_256,w_256/r_max/f_jpg,q_80",
      width: 256,
      height: 256,
      bytes: 18740,
      format: "jpg",
      url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_256,w_256/r_max/f_jpg,q_80/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.jpg",
      secure_url:
        "https://res.cloudinary.com/dhtzg8kkq/image/upload/c_thumb,g_face,h_256,w_256/r_max/f_jpg,q_80/v1743843545/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/avatar-d574547ce950f7d0111c_qj1uef.jpg",
    },
  ],
  api_key: "secret",
};

const testBackgroundAvatar01 = {
  asset_id: "ceffa10841419fae6d6eef1d6ae52da3",
  public_id:
    "dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l",
  version: 1743933208,
  version_id: "4fcdbf23b384eb1ac8d242c5da0daf26",
  signature: "0e1f015a49a115f93e51e295c0fc15788b750cf6",
  width: 1532,
  height: 2048,
  format: "jpg",
  resource_type: "image",
  created_at: "2025-04-06T09:43:58Z",
  tags: [],
  bytes: 322573,
  type: "upload",
  etag: "57507a4a21a17b620db6855f7a9e11c9",
  placeholder: false,
  url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.jpg",
  secure_url:
    "https://res.cloudinary.com/dhtzg8kkq/image/upload/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.jpg",
  asset_folder: "dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521",
  display_name: "backgroundAvatar-038b9b406770cac40929_gpd99l",
  overwritten: true,
  original_filename: "backgroundAvatar-d5bcb8cb8cc8e74ebdfd",
  original_extension: "jpeg",
  eager: [
    {
      transformation: "c_fill,h_240,w_600/f_webp,q_auto",
      width: 600,
      height: 240,
      bytes: 25764,
      format: "webp",
      url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/c_fill,h_240,w_600/f_webp,q_auto/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.webp",
      secure_url:
        "https://res.cloudinary.com/dhtzg8kkq/image/upload/c_fill,h_240,w_600/f_webp,q_auto/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.webp",
    },
    {
      transformation: "c_fill,h_320,w_800/e_blur:1000/f_webp,q_30",
      width: 800,
      height: 320,
      bytes: 3912,
      format: "webp",
      url: "http://res.cloudinary.com/dhtzg8kkq/image/upload/c_fill,h_320,w_800/e_blur:1000/f_webp,q_30/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.webp",
      secure_url:
        "https://res.cloudinary.com/dhtzg8kkq/image/upload/c_fill,h_320,w_800/e_blur:1000/f_webp,q_30/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.webp",
    },
  ],
  api_key: "secret",
};

export {
  testUser01,
  testUser02,
  testId,
  testFile01,
  testFile02,
  testAvatar01,
  testBackgroundAvatar01,
};
