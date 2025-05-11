-- DropIndex
DROP INDEX "messageIdIndex";

-- CreateIndex
CREATE INDEX "messageIdIndex" ON "Messages"("id");
