import BaseError from "./base-error.js";

class AuthError extends BaseError {
  constructor(
    message,
    httpCode,
    name = "Authentication Error",
    isOperational = true
  ) {
    super(message, httpCode, name, isOperational);
  }
}

export default AuthError;
