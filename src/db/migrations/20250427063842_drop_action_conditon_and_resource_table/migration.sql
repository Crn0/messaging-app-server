/*
  Warnings:

  - You are about to drop the column `action` on the `Permissions` table. All the data in the column will be lost.
  - You are about to drop the column `resource` on the `Permissions` table. All the data in the column will be lost.
  - You are about to drop the `PermissionActions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PermissionConditions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PermissionResources` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PermissionConditions" DROP CONSTRAINT "PermissionConditions_permsission_id_fkey";

-- DropForeignKey
ALTER TABLE "Permissions" DROP CONSTRAINT "Permissions_action_fkey";

-- DropForeignKey
ALTER TABLE "Permissions" DROP CONSTRAINT "Permissions_resource_fkey";

-- AlterTable
ALTER TABLE "Permissions" DROP COLUMN "action",
DROP COLUMN "resource";

-- DropTable
DROP TABLE "PermissionActions";

-- DropTable
DROP TABLE "PermissionConditions";

-- DropTable
DROP TABLE "PermissionResources";
