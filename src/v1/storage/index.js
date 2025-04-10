import cloudinary from "./cloudinary.js";

const storage = () =>
  Object.freeze({
    ...cloudinary,
  });

export default storage;
