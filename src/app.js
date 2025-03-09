import "dotenv/config";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import logger from "morgan";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import configs from "./configs/index.js";
import ErrorHandler from "./errors/error-handler.js";

const app = express();
// eslint-disable-next-line no-underscore-dangle
const __dirname =
  import.meta.dirname || dirname(fileURLToPath(import.meta.url));

app.use(cors(configs.cors));

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(express.static(join(__dirname, "..", "public")));

// ROUTES

// error handler
app.use((err, req, res, _) => {
  if (!ErrorHandler.isTrustedError(err)) {
    process.exit(1);
  } else {
    ErrorHandler.handleError(err, res);
  }
});

export default app;
