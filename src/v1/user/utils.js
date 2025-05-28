import { readdir, unlink } from "fs/promises";
import { v7 as uuidv7 } from "uuid";
import { faker } from "@faker-js/faker";

const removeTempImages = async (path) => {
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

export { removeTempImages, idGenerator, randomUsername, removeFields };
