import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import configs from "../../../../configs/index.js";
import { httpStatus } from "../../../../constants/index.js";
import ErrorHandler from "../../../../errors/error-handler.js";
import userRoute from "../../user-route.js";
import authRoute from "../../../auth/auth-route.js";

const app = express();

app.use(cors(configs.cors));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());
app.use(compression());

app.use("/api/v1/users", userRoute);
app.use("/api/v1/auth", authRoute);

app.use((err, req, res, _) => {
  if (!ErrorHandler.isTrustedError(err)) {
    console.log(err);
    res.sendStatus(httpStatus.INTERNAL_SERVER);
  } else {
    ErrorHandler.handleError(err, res);
  }
});

export default app;
