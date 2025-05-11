// password = Password1234
import { userIds } from "./id.js";

const normalUsers = [
  {
    id: userIds["john.doe"],
    username: "john.doe",
    email: "john@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "john" },
    accountLevel: 1,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-04T10:45:43.901Z",
  },
  {
    id: userIds["alice.smith"],
    username: "alice.smith",
    email: "alice@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "alice" },
    accountLevel: 1,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-05T09:15:22.451Z",
  },
  {
    id: userIds["david.wilson"],
    username: "david.wilson",
    email: "david@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "dave" },
    accountLevel: 1,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-05T09:30:55.134Z",
  },
  {
    id: userIds["frank.miller"],
    username: "frank.miller",
    email: "frank@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "frank" },
    accountLevel: 1,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-05T09:40:17.416Z",
  },
  {
    id: userIds["isabella.martinez"],
    username: "isabella.martinez",
    email: "isabella@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "bella" },
    accountLevel: 1,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-05T09:55:50.839Z",
  },
];

const demoUsers = [
  {
    id: userIds["jane.doe"],
    username: "jane.doe",
    email: "jane@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "jane" },
    accountLevel: 0,
    status: "Online",
    lastSeenAt: null,
    updatedAt: null,
    createdAt: "2025-04-04T10:45:53.252Z",
  },
  {
    id: userIds["bob.johnson"],
    username: "bob.johnson",
    email: "bob@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "bob" },
    accountLevel: 0,
    status: "Online",
    lastSeenAt: "2025-04-05T08:30:00.000Z",
    updatedAt: null,
    createdAt: "2025-04-05T09:20:33.712Z",
  },
  {
    id: userIds["eva.garcia"],
    username: "eva.garcia",
    email: "eva@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "eva" },
    accountLevel: 0,
    status: "Online",
    lastSeenAt: "2025-04-05T10:00:00.000Z",
    updatedAt: null,
    createdAt: "2025-04-05T09:35:06.275Z",
  },
  {
    id: userIds["henry.rodriguez"],
    username: "henry.rodriguez",
    email: "henry@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "hank" },
    accountLevel: 0,
    status: "Online",
    lastSeenAt: "2025-04-05T00:00:00.000Z",
    updatedAt: null,
    createdAt: "2025-04-05T09:50:39.698Z",
  },
  {
    id: userIds["jack.wilson"],
    username: "jack.wilson",
    email: "jack@example.com",
    password:
      "$argon2d$v=19$m=12288,t=3,p=1$Dp9N+jA0PyZxLFtHkJvfUw$dPz3cT+OA5KLSjnP+vlhyNQKSn0wvry24FCw/4j/e+8",
    profile: { displayName: "jack" },
    accountLevel: 0,
    status: "Online",
    lastSeenAt: "2025-04-05T11:00:00.000Z",
    updatedAt: null,
    createdAt: "2025-04-05T10:00:01.980Z",
  },
];

export default { normalUsers, demoUsers };
