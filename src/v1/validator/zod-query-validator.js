import { ZodError } from "zod";
import ValidationError from "../../errors/validation-error.js";

const ZodqueryValidator = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);

    next();
  } catch (e) {
    let message = "Validation Failed";
    let errors = {};

    if (e instanceof ZodError) {
      message = `Validation failed: ${e.issues.length} errors detected in query`;
      errors = e.issues;
    }

    const unprocessableRequestError = new ValidationError(message, errors);

    next(unprocessableRequestError);
  }
};

export default ZodqueryValidator;
