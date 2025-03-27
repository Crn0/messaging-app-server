import path from "path";
import { fileURLToPath } from "url";
import * as crypto from "node:crypto";
import { fileExtension } from "../helpers/index.js";
import FieldError from "../errors/field-error.js";

const MAX_FILE_SIZE = 10_000_000; // 10mb

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
