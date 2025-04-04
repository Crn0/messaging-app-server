/*
  Warnings:

  - You are about to drop the column `lazy_url` on the `Attachments` table. All the data in the column will be lost.
  - You are about to drop the column `public_id` on the `Attachments` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('webp', 'jpeg', 'jpg', 'png');

-- AlterTable
ALTER TABLE "Attachments" DROP COLUMN "lazy_url",
DROP COLUMN "public_id",
ALTER COLUMN "id" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "Images" (
    "pk" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "size" INTEGER,
    "attachmentPk" INTEGER NOT NULL,

    CONSTRAINT "Images_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Files" (
    "pk" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "attachmentPk" INTEGER NOT NULL,

    CONSTRAINT "Files_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Images_attachmentPk_pk_key" ON "Images"("attachmentPk", "pk");

-- CreateIndex
CREATE UNIQUE INDEX "Files_attachmentPk_pk_key" ON "Files"("attachmentPk", "pk");

-- AddForeignKey
ALTER TABLE "Images" ADD CONSTRAINT "Images_attachmentPk_fkey" FOREIGN KEY ("attachmentPk") REFERENCES "Attachments"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_attachmentPk_fkey" FOREIGN KEY ("attachmentPk") REFERENCES "Attachments"("pk") ON DELETE CASCADE ON UPDATE CASCADE;
