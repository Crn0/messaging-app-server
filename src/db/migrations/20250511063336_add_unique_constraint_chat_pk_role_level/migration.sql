/*
  Warnings:

  - A unique constraint covering the columns `[chat_pk,role_level]` on the table `Roles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Roles_chat_pk_role_level_key" ON "Roles"("chat_pk", "role_level");
