import "dotenv/config";
import { join } from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import configs from "../../../../configs/index.js";
import { httpStatus } from "../../../../constants/index.js";
import { removeTempImages } from "../../utils.js";
import ErrorHandler from "../../../../errors/error-handler.js";
import chatRoute from "../../chat-route.js";

const { dirname } = import.meta;

const app = express();

app.use(cors(configs.cors));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());
app.use(compression());

app.use("/api/v1/chats", chatRoute);

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
