import { join } from "path";
import { readdir, unlink } from "fs/promises";
import { v7 as uuidv7 } from "uuid";
import { faker } from "@faker-js/faker";

const removeTempImages = async (dirname) => {
  const path = join(dirname, "..", "temp", "images");

  const dir = await readdir(path);

  await Promise.all(
    dir.map(async (fileName) => {
      const filePath = `${path}/${fileName}`;

      if (fileName === ".gitkeep") return;

      await unlink(filePath);
    })
  );
};

const idGenerator = () => uuidv7();

const randomUsername = ({ firstName, lastName }) =>
  faker.internet.username({ firstName, lastName });

const buildIncludeQuery = (queries, value) => {
  if (!Array.isArray(queries)) return null;

  return queries.reduce((result, path) => {
    const fields = path.split(".");

    let temp = result;

    fields.forEach((field, index) => {
      const isRootField = index === 0 && !temp?.[field];
      const isNestedField = index !== 0 && !temp?.select?.[field];

      if (isRootField) {
        temp[field] = {};
        temp[field].select = {};
      }

      if (isNestedField) {
        temp.select[field] =
          index === fields.length - 1 ? value : { select: {} };
      }

      if (index === 0) {
        temp = temp[field];

        return;
      }

      temp = temp?.select[field];
    });

    return result;
  }, {});
};

const normalizeInclude = (include) => {
  if (typeof include !== "string") {
    return null;
  }

  return include.split(",").map((field) => {
    let clone = field;

    if (clone.includes("avatar")) {
      clone = clone.replace("avatar", "avatar.images.url");
    }

    if (clone.includes("chats")) {
      clone = clone.replace("chats", "chats.chat");
    }

    if (clone.includes("members")) {
      clone = clone.replace("members", "members.user");
    }

    return clone;
  });
};

const removeFields = (obj, fieldsToRemove) => {
  if (!Array.isArray(fieldsToRemove)) {
    throw new Error(
      `fieldsToRemove is type of ${typeof fieldsToRemove}; expected an type of array`
    );
  }

  const fields = new Set(fieldsToRemove);

  return Object.fromEntries(
    Object.entries(obj).filter(([value, _]) => !fields.has(value))
  );
};

export {
  removeTempImages,
  idGenerator,
  randomUsername,
  buildIncludeQuery,
  normalizeInclude,
  removeFields,
};
