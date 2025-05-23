import BaseError from "./base-error.js";
import { env } from "../constants/index.js";
import sendErrorResponce from "../response/error-response.js";

class ErrorHandler {
  static handleError(error, res) {
    if (env.NODE_ENV === "dev") {
      console.log(error);
    }

    const { httpCode, message, errors } = error;

    const errorResponse = sendErrorResponce(res);

    return errorResponse(httpCode, message, errors);
  }

  static isTrustedError(error) {
    if (error instanceof BaseError) {
      return error.isOperational;
    }

    return false;
  }
}

export default Object.freeze(ErrorHandler);
