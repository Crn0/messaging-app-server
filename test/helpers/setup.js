import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

const permissions = [
  // GENERAL SERVER PERMISSIONS
  "manage_role",
  "manage_chat",
  "view_chat",
  // MEMBERSHIP PERMISSIONS
  "create_invite",
  "manage_member",
  "kick_member",
  "mute_member",
  // TEXT PERMISSIONS
  "send_message",
  "manage_message",
  // ADVANCED PERMISSIONS
  "admin",
];

await client.permission.createMany({
  data: permissions.map((name) => ({ name })),
  skipDuplicates: true,
});
