import initCloudinary from "../lib/cloudinary.js";
import StorageError from "../../errors/storage-error.js";
import { env } from "../../constants/index.js";

const cloudinary = initCloudinary();

const url = (publicId, transformation) =>
  cloudinary.url(publicId, {
    transformation,
  });

const usage = async () => cloudinary.api.usage();

const upload = async (
  folder,
  path,
  mimeType,
  eagerOptions,
  useFilename = true
) => {
  try {
    if (mimeType === "application/epub+zip") {
      return cloudinary.uploader.upload(path, {
        folder,
        resource_type: "raw",
        use_filename: !!useFilename,
      });
    }

    return cloudinary.uploader.upload(path, {
      folder,
      resource_type: "image",
      eager: eagerOptions,
      use_filename: !!useFilename,
      invalidate: true,
    });
  } catch (e) {
    throw new StorageError(
      e.message ?? e.error.message,
      e.http_code ?? e.error.http_code
    );
  }
};

const update = async (path, publicId, eagerOptions) => {
  try {
    return cloudinary.uploader.upload(path, {
      public_id: publicId,
      eager: eagerOptions,
      resource_type: "image",
      invalidate: true,
    });
  } catch (e) {
    throw new StorageError(
      e.message ?? e.error.message,
      e.http_code ?? e.error.http_code
    );
  }
};

const getFile = async (publicId) => {
  try {
    const res = await cloudinary.api.resource(publicId);

    return res;
  } catch (e) {
    throw new StorageError(
      e.message ?? e.error.message,
      e.http_code ?? e.error.http_code
    );
  }
};

const destroyFolder = async (path) => {
  try {
    await cloudinary.api.delete_resources_by_prefix(path);

    const res = await cloudinary.api.delete_folder(path);
    return res;
  } catch (e) {
    throw new StorageError(
      e.message ?? e.error.message,
      e.http_code ?? e.error.http_code
    );
  }
};

const destroyFile = async (publicId, resourceType) => {
  const type = resourceType.toLowerCase();

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: type,
    });

    return res;
  } catch (e) {
    throw new StorageError(
      e.message ?? e.error.message,
      e.http_code ?? e.error.http_code
    );
  }
};

export default {
  url,
  usage,
  upload,
  update,
  getFile,
  destroyFile,
  destroyFolder,
};
