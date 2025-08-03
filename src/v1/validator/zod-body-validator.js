import { ZodError } from "zod";
import { unlink } from "fs/promises";

import ValidationError from "../../errors/validation-error.js";

const cleanFiles = async (req) => {
  const unlinkPromises = [];

  if (req.files && typeof req.files === "object" && !Array.isArray(req.files)) {
    const entries = Object.entries(req.files);

    entries.forEach(([_, fileOrFiles]) => {
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

      files.forEach((file) => {
        if (file?.path) unlinkPromises.push(unlink(file.path));
      });
    });
  }

  if (Array.isArray(req.body?.attachments)) {
    req.body?.attachments.forEach((file) =>
      unlinkPromises.push(unlink(file.path))
    );
  }

  if (req.body?.avatar || req.body?.backgroundAvatar) {
    const files = [req.body?.avatar, req.body?.backgroundAvatar].filter(
      Boolean
    );

    files.forEach((file) => unlinkPromises.push(unlink(file.path)));
  }

  await Promise.allSettled(unlinkPromises);
};

const ZodbodyValidator = (schema) => async (req, res, next) => {
  if (req.file) {
    req.body.avatar = req.file;
  }

  if (req.files && typeof req.files === "object" && !Array.isArray(req.files)) {
    const files = Object.entries(req.files);

    req.body = {
      ...req.body,
      ...files.reduce(
        (result, [key, values]) => ({
          ...result,
          [key]: values[0],
        }),
        {}
      ),
    };
  }

  if (Array.isArray(req.files)) {
    req.body.attachments = req.files;
  }

  try {
    req.body = schema.parse(req.body);

    next();
  } catch (e) {
    let message = "Validation Failed";
    let errors = {};

    await cleanFiles(req);

    if (e instanceof ZodError) {
      message = `Validation failed: ${e.issues.length} errors detected in body`;
      errors = e.issues;
    }

    const unprocessableRequestError = new ValidationError(message, errors);

    next(unprocessableRequestError);
  }
};

export default ZodbodyValidator;
