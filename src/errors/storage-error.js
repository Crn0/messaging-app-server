import BaseError from "./base-error.js";

class StorageError extends BaseError {
  constructor(message, httpCode, name = "Storage Error", isOperational = true) {
    super(message, httpCode, name, isOperational);
  }
}

export default StorageError;
