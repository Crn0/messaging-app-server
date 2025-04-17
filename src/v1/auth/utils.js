import { faker } from "@faker-js/faker";
import argon2 from "argon2";
import { v7 as uuidv7 } from "uuid";

const randomUsername = ({ firstName, lastName }) =>
  faker.internet.username({ firstName, lastName });

const hashPassword = async (password) =>
  argon2.hash(password, {
    type: argon2.argon2d,
    memoryCost: 12288,
    timeCost: 3,
    parallelism: 1,
  });

const verifyPassword = async (digest, password) =>
  argon2.verify(digest, password);

const idGenerator = () => uuidv7();

export { randomUsername, hashPassword, verifyPassword, idGenerator };
