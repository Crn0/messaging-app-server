import { PrismaClient } from "@prisma/client";
import constants from "../constants/index.js";

const databaseUrl =
  constants.env.NODE_ENV === "test"
    ? constants.env.TEST_DATABASE_URL
    : constants.env.DATABASE_URL;

export default new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});
