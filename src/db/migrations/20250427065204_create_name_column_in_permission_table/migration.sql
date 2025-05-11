/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Permissions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Permissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Permissions" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_name_key" ON "Permissions"("name");
