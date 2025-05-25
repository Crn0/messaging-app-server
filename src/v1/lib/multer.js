import multer, { MulterError } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import ValidationError from "../../errors/validation-error.js";

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

const fileFilter = (fileTypes) => (req, file, cb) => {
  if (typeof fileTypes === "undefined") return cb(null, true);

  // Check ext
  const ext = fileTypes.test(extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = fileTypes.test(file.mimetype);

  if (mimetype && ext) {
    return cb(null, true);
  }

  return cb(
    new ValidationError(
      "Validation Error",
      {
        code: "custom",
        message: `Only ${fileTypes} formats are supported.`,
        path: [`${file.fieldname}`],
      },
      400
    ),

    false
  );
};

const storage = {
  destination: (path) => (req, file, cb) => {
    cb(null, path);
  },
  filename: (req, file, cb) => {
    const name = `${file.fieldname}-${uuidv4()}${fileExtension(file.mimetype)}`;
    cb(null, name);
  },
};

export default ({ path, limits, fileTypes }) => ({
  multer: multer({
    limits,
    storage: multer.diskStorage({
      ...storage,
      destination: storage.destination(path),
    }),
    fileFilter: fileFilter(fileTypes),
  }),
  MulterError,
});
