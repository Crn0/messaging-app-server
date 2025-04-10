import { PrismaClient } from "@prisma/client";
import { env } from "../constants/index.js";

const databaseUrl = env.DATABASE_URL;

export default new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});
