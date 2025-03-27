import path from "path";
import { fileURLToPath } from "url";
import * as crypto from "node:crypto";
import FieldError from "../errors/field-error.js";

const MAX_FILE_SIZE = 10_000_000; // 10mb

const fileExtension = (mimeType) => {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpeg";
    case "image/jpg":
      return ".jpeg";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    case "application/epub+zip":
      return ".epub";
    default:
      return "";
  }
};

function fileFilter(req, file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|epub|pdf/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }

  return cb(
    new FieldError(
      "Validation Failed",
      {
        type: "fields",
        field: `${file.fieldname}`,
        message: `400 Bad Request: The MIME type ${file.mimetype} is not supported by the server. Please upload a file with one of the following supported formats: .jpg, .png, .webp, .pdf or .epub`,
      },
      400
    ),

    false
  );
}

const storage = {
  destination: (req, file, cb) => {
    cb(
      null,
      path.join(
        import.meta.dirname || path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "temp",
        "images"
      )
    );
  },
  filename: (req, file, cb) => {
    const name = `${file.fieldname}-${crypto.randomBytes(10).toString("hex")}${fileExtension(file.mimetype)}`;
    cb(null, name);
  },
};

const config = { storage, fileFilter, MAX_FILE_SIZE };

export default config;
