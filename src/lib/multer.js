import multer from "multer";
import configs from "../configs/index.js";

export default multer({
  storage: multer.diskStorage(configs.multer.storage),
});
