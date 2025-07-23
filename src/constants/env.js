import "dotenv/config";

const { NODE_ENV } = process.env;

const { GOOGLE_CLIENT_ID } = process.env;
const { GOOGLE_CLIENT_SECRET } = process.env;
const { GOOGLE_CALLBACK_URL } = process.env;

const PORT = process.env.PORT || 3000;

const CORS_ORIGINS = process.env?.CORS_ORIGINS?.split(",");
const CORS_METHODS = process.env.CORS_METHODS || "GET,HEAD,PUT,POST,DELETE";

const DATABASE_URL = process.env?.DATABASE_URL;
const TEST_DATABASE_URL = process.env?.TEST_DATABASE_URL;

const CLOUDINARY_ROOT_NAME = process.env?.CLOUDINARY_ROOT_NAME || "dev";
const CLOUDINARY_NAME = process.env?.CLOUDINARY_NAME;
const CLOUDINARY_API_KEY = process.env?.CLOUDINARY_API_KEY;
const CLOUDINARY_SECRET = process.env?.CLOUDINARY_SECRET;

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

const TEST_UPLOAD = process.env.TEST_UPLOAD === "true";

const TRANSACTION_MAX_TIMEOUT = process.env.TEST_UPLOAD || 20_000;

export default {
  NODE_ENV,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  PORT,
  CORS_ORIGINS,
  CORS_METHODS,
  DATABASE_URL,
  TEST_DATABASE_URL,
  CLOUDINARY_ROOT_NAME,
  CLOUDINARY_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_SECRET,
  SERVER_URL,
  CLIENT_URL,
  JWT_SECRET,
  TEST_UPLOAD,
  TRANSACTION_MAX_TIMEOUT,
};
