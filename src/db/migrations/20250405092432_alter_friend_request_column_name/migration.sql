/*
  Warnings:

  - You are about to drop the column `reciever_pk` on the `FriendRequests` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[requester_pk,receiver_pk]` on the table `FriendRequests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `receiver_pk` to the `FriendRequests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FriendRequests" DROP CONSTRAINT "FriendRequests_reciever_pk_fkey";

-- DropIndex
DROP INDEX "FriendRequests_requester_pk_reciever_pk_key";

-- AlterTable
ALTER TABLE "FriendRequests" RENAME COLUMN "reciever_pk" TO "receiver_pk";

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequests_requester_pk_receiver_pk_key" ON "FriendRequests"("requester_pk", "receiver_pk");

-- AddForeignKey
ALTER TABLE "FriendRequests" ADD CONSTRAINT "FriendRequests_receiver_pk_fkey" FOREIGN KEY ("receiver_pk") REFERENCES "Users"("pk") ON DELETE RESTRICT ON UPDATE CASCADE;
