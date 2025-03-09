import "dotenv/config";

const { NODE_ENV } = process.env;

const PORT = process.env || 3000;

const CORS_ORIGINS = process.env?.CORS_ORIGINS;
const CORS_METHODS = process.env.CORS_METHODS || "GET,HEAD,PUT,POST,DELETE";

const DATABASE_URL = process.env?.DATABASE_URL;
const TEST_DATABASE_URL = process.env?.TEST_DATABASE_URL;

const CLOUDINARY_NAME = process.env?.CLOUDINARY_NAME;
const CLOUDINARY_API_KEY = process.env?.CLOUDINARY_API_KEY;
const CLOUDINARY_SECRET = process.env?.CLOUDINARY_SECRET;

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

export default {
  NODE_ENV,
  PORT,
  CORS_ORIGINS,
  CORS_METHODS,
  DATABASE_URL,
  TEST_DATABASE_URL,
  CLOUDINARY_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_SECRET,
  SERVER_URL,
  CLIENT_URL,
};
