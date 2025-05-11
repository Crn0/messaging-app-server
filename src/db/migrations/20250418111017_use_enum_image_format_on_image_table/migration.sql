/*
  Warnings:

  - Changed the type of `format` on the `Images` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Images" DROP COLUMN "format",
ADD COLUMN     "format" "ImageFormat" NOT NULL;
