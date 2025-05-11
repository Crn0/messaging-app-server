-- AlterTable
ALTER TABLE "UserOnChats" ALTER COLUMN "muted_until" DROP NOT NULL,
ALTER COLUMN "muted_until" DROP DEFAULT;
