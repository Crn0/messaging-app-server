import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as crypto from "node:crypto";

const fileExtensions = (mimeType) => {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpeg";
    case "image/jpg":
      return ".jpeg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(
      null,
      path.join(
        import.meta.dirname || path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "temp",
        "images",
      ),
    );
  },
  filename: (req, file, cb) => {
    const name = `${file.fieldname}-${crypto.randomBytes(10).toString("hex")}${fileExtensions(file.mimetype)}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

export default upload;
