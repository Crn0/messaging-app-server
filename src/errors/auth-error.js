import BaseError from "./base-error.js";

class AuthError extends BaseError {
  constructor(
    message,
    httpCode,
    name = "Authentication Error",
    errors = null,
    isOperational = true
  ) {
    super(message, httpCode, name, errors, isOperational);
  }
}

export default AuthError;
