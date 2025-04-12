-- DropForeignKey
ALTER TABLE "FriendRequests" DROP CONSTRAINT "FriendRequests_receiver_pk_fkey";

-- DropForeignKey
ALTER TABLE "FriendRequests" DROP CONSTRAINT "FriendRequests_requester_pk_fkey";

-- AddForeignKey
ALTER TABLE "FriendRequests" ADD CONSTRAINT "FriendRequests_requester_pk_fkey" FOREIGN KEY ("requester_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequests" ADD CONSTRAINT "FriendRequests_receiver_pk_fkey" FOREIGN KEY ("receiver_pk") REFERENCES "Users"("pk") ON DELETE CASCADE ON UPDATE CASCADE;
