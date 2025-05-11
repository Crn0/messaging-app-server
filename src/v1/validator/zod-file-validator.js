import { ZodError } from "zod";
import ValidationError from "../../errors/validation-error.js";

const ZodfileValidator = (schema, key) => (req, res, next) => {
  if (typeof key !== "string") {
    throw new Error(
      `Invalid type of "key" expected typeof "string"; received: ${typeof key}`
    );
  }

  try {
    req.file = schema.parse({ [key]: req.file });

    next();
  } catch (e) {
    let message = "Validation Failed";
    let errors = {};

    if (e instanceof ZodError) {
      message = `Validation failed: ${e.issues.length} errors detected in file`;
      errors = e.issues;
    }

    const unprocessableRequestError = new ValidationError(message, errors);

    next(unprocessableRequestError);
  }
};

export default ZodfileValidator;
