import BaseError from "./base-error.js";

class APIError extends BaseError {
  constructor(
    message,
    httpCode,
    name = "API Error",
    errors = null,
    isOperational = true
  ) {
    super(message, httpCode, name, errors, isOperational);
  }
}

export default APIError;
