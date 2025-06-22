import "dotenv/config";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import logger from "morgan";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { httpStatus } from "./constants/index.js";
import { removeTempImages } from "./lib/index.js";
import configs from "./configs/index.js";
import routes from "./routes/index.js";
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
app.use(routes.V1);

process.stdin.resume();
/**
 *  remove the uploaded image when the server closed
 */
[
  "exit",
  "SIGINT",
  "SIGUSR1",
  "SIGUSR2",
  "uncaughtException",
  "SIGTERM",
].forEach((eventType) => {
  process.on(eventType, async () => {
    try {
      await removeTempImages(join(__dirname, "temp", "upload"));
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
});

// error handler
app.use((err, req, res, _) => {
  if (err.type === "entity.parse.failed") {
    return res.status(err.status).json({
      code: err.statusCode,
      message: err.message,
    });
  }

  if (!ErrorHandler.isTrustedError(err)) {
    return res.sendStatus(httpStatus.INTERNAL_SERVER);
  }

  return ErrorHandler.handleError(err, res);
});

export default app;
