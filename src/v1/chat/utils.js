import { readdir, unlink } from "fs/promises";
import { v7 as uuidv7 } from "uuid";

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

const determineAccessPolicy = (policy, field) => {
  if (typeof policy === "function") return policy;

  if (field && policy?.[field]) return policy[field];

  return policy;
};

const executePolicy =
  (permissionPolicies) =>
  (subject, data, { resource, action, field, context }) => {
    const permission = permissionPolicies[resource]?.[action];
    const policy = determineAccessPolicy(permission, field);

    if (typeof policy === "boolean") return policy;
    if (typeof policy === "function") return policy(subject, data, context);

    return subject.roles.some((role) => {
      const isValidRole = data.roles.some(
        (dataRole) => dataRole.id === role.id
      );

      if (!isValidRole) return false;

      return permission.some((perm) =>
        role.permissions.some((p) => p.name === perm)
      );
    });
  };

export {
  removeTempImages,
  idGenerator,
  removeFields,
  determineAccessPolicy,
  executePolicy,
};
