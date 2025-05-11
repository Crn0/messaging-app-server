import argon2 from "argon2";

const verifyPassword = async (digest, password) =>
  argon2.verify(digest, password);

export default verifyPassword;
