-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('Image', 'Epub', 'Pdf');

-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('GroupChat', 'DirectChat');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Online', 'Offline', 'Invisible');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('RefreshToken', 'ActionToken');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('google', 'github', 'facebook');

-- CreateTable
CREATE TABLE "Attachments" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "url" TEXT NOT NULL,
    "lazy_url" TEXT,
    "size" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "type" "AttachmentType" NOT NULL,
    "chat_pk" INTEGER,
    "group_chat_pk" INTEGER,
    "profile_avatar_pk" INTEGER,
    "profile_background_avatar_pk" INTEGER,
    "message_id" INTEGER,

    CONSTRAINT "Attachments_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Chats" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "name" VARCHAR(255),
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "type" "ChatType" NOT NULL,
    "owner_pk" INTEGER,

    CONSTRAINT "Chats_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Roles" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role_level" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "chat_pk" INTEGER NOT NULL,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "PermissionResources" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "PermissionResources_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "PermissionActions" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "PermissionActions_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "PermissionConditions" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "permsission_id" INTEGER NOT NULL,
    "field" VARCHAR(255) NOT NULL,
    "operator" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "PermissionConditions_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Users" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "password" TEXT,
    "account_level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,
    "status" "UserStatus" NOT NULL DEFAULT 'Online',

    CONSTRAINT "Users_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Profiles" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "display_name" VARCHAR(255),
    "about_me" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "user_pk" INTEGER NOT NULL,

    CONSTRAINT "Profiles_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "UserOnChats" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted_until" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_pk" INTEGER NOT NULL,
    "chat_pk" INTEGER NOT NULL,

    CONSTRAINT "UserOnChats_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Tokens" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "expires_in" TIMESTAMP(3) NOT NULL,
    "type" "TokenType" NOT NULL,
    "user_pk" INTEGER NOT NULL,

    CONSTRAINT "Tokens_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "FriendRequests" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "requester_pk" INTEGER NOT NULL,
    "reciever_pk" INTEGER NOT NULL,

    CONSTRAINT "FriendRequests_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "OpenIDs" (
    "pk" SERIAL NOT NULL,
    "sub" VARCHAR(255) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "provider" "Provider" NOT NULL,
    "user_pk" INTEGER NOT NULL,

    CONSTRAINT "OpenIDs_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Messages" (
    "pk" SERIAL NOT NULL,
    "id" UUID NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "user_pk" INTEGER NOT NULL,
    "chat_pk" INTEGER NOT NULL,
    "reply_to_pk" INTEGER,

    CONSTRAINT "Messages_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "_RoleToUserOnChat" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_RolePermissions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_Friends" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_BlockedUsers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachments_id_key" ON "Attachments"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Attachments_group_chat_pk_key" ON "Attachments"("group_chat_pk");

-- CreateIndex
CREATE UNIQUE INDEX "Attachments_profile_avatar_pk_key" ON "Attachments"("profile_avatar_pk");

-- CreateIndex
CREATE UNIQUE INDEX "Attachments_profile_background_avatar_pk_key" ON "Attachments"("profile_background_avatar_pk");

-- CreateIndex
CREATE UNIQUE INDEX "Attachments_chat_pk_message_id_key" ON "Attachments"("chat_pk", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "Chats_id_key" ON "Chats"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Chats_name_key" ON "Chats"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Chats_pk_id_key" ON "Chats"("pk", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_id_key" ON "Roles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_role_level_key" ON "Roles"("role_level");

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_id_key" ON "Permissions"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionResources_id_key" ON "PermissionResources"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionResources_name_key" ON "PermissionResources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionActions_id_key" ON "PermissionActions"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionActions_name_key" ON "PermissionActions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionConditions_id_key" ON "PermissionConditions"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Users_id_key" ON "Users"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Users_username_key" ON "Users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "username_index" ON "Users"("username" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Profiles_id_key" ON "Profiles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Profiles_user_pk_key" ON "Profiles"("user_pk");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnChats_id_key" ON "UserOnChats"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnChats_user_pk_chat_pk_key" ON "UserOnChats"("user_pk", "chat_pk");

-- CreateIndex
CREATE UNIQUE INDEX "Tokens_id_key" ON "Tokens"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequests_id_key" ON "FriendRequests"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequests_requester_pk_reciever_pk_key" ON "FriendRequests"("requester_pk", "reciever_pk");

-- CreateIndex
CREATE UNIQUE INDEX "OpenIDs_provider_user_pk_key" ON "OpenIDs"("provider", "user_pk");

-- CreateIndex
CREATE UNIQUE INDEX "OpenIDs_provider_sub_key" ON "OpenIDs"("provider", "sub");

-- CreateIndex
CREATE UNIQUE INDEX "Messages_id_key" ON "Messages"("id");

-- CreateIndex
CREATE INDEX "messageIdIndex" ON "Messages"("id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Messages_pk_user_pk_key" ON "Messages"("pk", "user_pk");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUserOnChat_AB_unique" ON "_RoleToUserOnChat"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUserOnChat_B_index" ON "_RoleToUserOnChat"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RolePermissions_AB_unique" ON "_RolePermissions"("A", "B");

-- CreateIndex
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Friends_AB_unique" ON "_Friends"("A", "B");

-- CreateIndex
CREATE INDEX "_Friends_B_index" ON "_Friends"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BlockedUsers_AB_unique" ON "_BlockedUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_BlockedUsers_B_index" ON "_BlockedUsers"("B");

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_chat_pk_fkey" FOREIGN KEY ("chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_group_chat_pk_fkey" FOREIGN KEY ("group_chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_profile_avatar_pk_fkey" FOREIGN KEY ("profile_avatar_pk") REFERENCES "Profiles"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_profile_background_avatar_pk_fkey" FOREIGN KEY ("profile_background_avatar_pk") REFERENCES "Profiles"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Messages"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chats" ADD CONSTRAINT "Chats_owner_pk_fkey" FOREIGN KEY ("owner_pk") REFERENCES "Users"("pk") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_chat_pk_fkey" FOREIGN KEY ("chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissions" ADD CONSTRAINT "Permissions_resource_fkey" FOREIGN KEY ("resource") REFERENCES "PermissionResources"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissions" ADD CONSTRAINT "Permissions_action_fkey" FOREIGN KEY ("action") REFERENCES "PermissionActions"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionConditions" ADD CONSTRAINT "PermissionConditions_permsission_id_fkey" FOREIGN KEY ("permsission_id") REFERENCES "Permissions"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profiles" ADD CONSTRAINT "Profiles_user_pk_fkey" FOREIGN KEY ("user_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnChats" ADD CONSTRAINT "UserOnChats_user_pk_fkey" FOREIGN KEY ("user_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnChats" ADD CONSTRAINT "UserOnChats_chat_pk_fkey" FOREIGN KEY ("chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_user_pk_fkey" FOREIGN KEY ("user_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequests" ADD CONSTRAINT "FriendRequests_requester_pk_fkey" FOREIGN KEY ("requester_pk") REFERENCES "Users"("pk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequests" ADD CONSTRAINT "FriendRequests_reciever_pk_fkey" FOREIGN KEY ("reciever_pk") REFERENCES "Users"("pk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenIDs" ADD CONSTRAINT "OpenIDs_user_pk_fkey" FOREIGN KEY ("user_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_reply_to_pk_fkey" FOREIGN KEY ("reply_to_pk") REFERENCES "Messages"("pk") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_chat_pk_fkey" FOREIGN KEY ("chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_user_pk_fkey" FOREIGN KEY ("user_pk") REFERENCES "Users"("pk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUserOnChat" ADD CONSTRAINT "_RoleToUserOnChat_A_fkey" FOREIGN KEY ("A") REFERENCES "Roles"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUserOnChat" ADD CONSTRAINT "_RoleToUserOnChat_B_fkey" FOREIGN KEY ("B") REFERENCES "UserOnChats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Permissions"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "Roles"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Friends" ADD CONSTRAINT "_Friends_A_fkey" FOREIGN KEY ("A") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Friends" ADD CONSTRAINT "_Friends_B_fkey" FOREIGN KEY ("B") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlockedUsers" ADD CONSTRAINT "_BlockedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlockedUsers" ADD CONSTRAINT "_BlockedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;
