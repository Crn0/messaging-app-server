import { ZodError } from "zod";
import ValidationError from "../../errors/validation-error.js";

const ZodparamValidator = (schema) => (req, res, next) => {
  try {
    req.params = schema.parse(req.params);

    next();
  } catch (e) {
    let message = "Validation Failed";
    let errors = {};

    if (e instanceof ZodError) {
      message = `Validation failed: ${e.issues.length} errors detected in params`;
      errors = e.issues;
    }

    const unprocessableRequestError = new ValidationError(message, errors);

    next(unprocessableRequestError);
  }
};

export default ZodparamValidator;
