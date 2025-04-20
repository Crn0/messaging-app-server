import "dotenv/config";
import { faker } from "@faker-js/faker";
import createJwtUtils from "../../../auth/jwt.js";
import { idGenerator } from "../../utils.js";
import { hashPassword } from "../../../auth/utils.js";

const generateRandomPassword = () => {
  // https://regexr.com/8dm04
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

  let password = faker.internet.password({
    length: 8,
  });

  while (!regex.test(password)) {
    password = faker.internet.password({
      length: 8,
    });
  }

  return password;
};

const jwtUtils = createJwtUtils({
  secret: "secret",
  idGenerator,
});

class CreateUser {
  pk = 0;

  async create(accountLevel) {
    this.pk += 1;
    const primaryKey = this.pk;
    const id = idGenerator();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = faker.internet.username({ firstName, lastName });
    const email = faker.internet.email({ firstName, lastName });
    const displayName = faker.internet.displayName({ firstName, lastName });
    const status = "Online";
    const password = generateRandomPassword();
    const level = Number.isNaN(Number(accountLevel)) ? 1 : accountLevel;
    const hash = await hashPassword(password);
    const createdAt = new Date();
    const updatedAt = null;
    const lastSeenAt = null;
    const accessToken = jwtUtils.generateAccessToken(id, "500");
    const refreshToken = jwtUtils.generateRefreshToken(id, "500");
    const expiredToken = jwtUtils.generateAccessToken(id, "0");
    const invalidToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTk2MTViNS04ZTU3LTc1ODMtYmRjNC03N2NhZDhmYTk2ZTYiLCJleHAiOjE3NDQxMjEyNDIsImlhdCI6MTc0NDEyMDk0Mn0.9g4K47HbvpLqEt9pFQwp_nuNnOMmszmPqi_edcn8ilw";

    return Object.freeze({
      data: {
        id,
        firstName,
        lastName,
        username,
        email,
        displayName,
        status,
        password,
        createdAt,
        updatedAt,
        lastSeenAt,
        accessToken,
        refreshToken,
        expiredToken,
        invalidToken,
        pk: primaryKey,
        accountLevel: level,
        chats: [],
        messages: [],
        blockedUsers: [],
        blockedBy: [],
        friends: [],
      },
      entity: {
        id,
        username,
        email,
        status,
        createdAt,
        updatedAt,
        lastSeenAt,
        accountLevel: level,
        profile: {
          create: {
            displayName,
          },
        },
        password: hash,
      },
    });
  }
}

const userFactory = () => new CreateUser();

export default userFactory;
