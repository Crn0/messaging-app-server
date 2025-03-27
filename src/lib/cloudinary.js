import { v2 as cloudinary } from "cloudinary";
import config from "../configs/index.js";

cloudinary.config(config.cloudinary);

export default cloudinary;
