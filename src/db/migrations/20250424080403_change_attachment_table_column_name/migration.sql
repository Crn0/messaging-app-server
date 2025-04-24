/*
  Warnings:

  - You are about to drop the column `message_id` on the `Attachments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Attachments" DROP CONSTRAINT "Attachments_message_id_fkey";

-- AlterTable
ALTER TABLE "Attachments" DROP COLUMN "message_id",
ADD COLUMN     "message_pk" INTEGER;

-- AddForeignKey
ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_message_pk_fkey" FOREIGN KEY ("message_pk") REFERENCES "Messages"("pk") ON DELETE CASCADE ON UPDATE CASCADE;
