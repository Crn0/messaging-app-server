import { ZodError } from "zod";
import ValidationError from "../../errors/validation-error.js";

const ZodbodyValidator = (schema) => (req, res, next) => {
  if (req.file) {
    req.body.avatar = req.file;
  }

  if (req.files) {
    req.body.attachments = req.files;
  }

  try {
    req.body = schema.parse(req.body);

    next();
  } catch (e) {
    let message = "Validation Failed";
    let errors = {};

    if (e instanceof ZodError) {
      message = `Validation failed: ${e.issues.length} errors detected in body`;
      errors = e.issues;
    }

    const unprocessableRequestError = new ValidationError(message, errors);

    next(unprocessableRequestError);
  }
};

export default ZodbodyValidator;
