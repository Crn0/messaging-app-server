import argon2 from "argon2";

const hashPassword = async (password) =>
  argon2.hash(password, {
    type: argon2.argon2d,
    memoryCost: 12288,
    timeCost: 3,
    parallelism: 1,
  });

export default hashPassword;
