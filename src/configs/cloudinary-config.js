import constants from "../constants/index.js";

const config = {
  cloud_name: constants.env.CLOUDINARY_NAME,
  api_key: constants.env.CLOUDINARY_API_KEY,
  api_secret: constants.env.CLOUDINARY_SECRET,
};

export default config;
