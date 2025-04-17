import initCloudinary from "../lib/cloudinary.js";
import StorageError from "../../errors/storage-error.js";
import { env } from "../../constants/index.js";

const cloudinary = initCloudinary();

const url = (publicId, transformation) =>
  cloudinary.url(publicId, {
    transformation,
  });

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
    throw new StorageError(e.message, e.http_code);
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
    throw new StorageError(e.message, e.http_code);
  }
};

const destroyFolder = async (path) => {
  await cloudinary.api.delete_resources_by_prefix(path);

  return cloudinary.api.delete_folder(path);
};

const destroyFile = async (publicId, resourceType) => {
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: resourceType,
    });

    return res;
  } catch (e) {
    throw new StorageError(e.message, e.http_code);
  }
};

export default { url, upload, update, destroyFile, destroyFolder };
