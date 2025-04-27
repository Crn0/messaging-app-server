/*
  Warnings:

  - Added the required column `is_default_role` to the `Roles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Roles" ADD COLUMN     "is_default_role" BOOLEAN NOT NULL;
