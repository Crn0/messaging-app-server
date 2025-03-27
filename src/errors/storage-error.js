import BaseError from "./base-error.js";

class StorageError extends BaseError {
  constructor(
    message,
    httpCode,
    name = "Storage Error",
    errors = null,
    isOperational = true
  ) {
    super(message, httpCode, name, errors, isOperational);
  }
}

export default StorageError;
