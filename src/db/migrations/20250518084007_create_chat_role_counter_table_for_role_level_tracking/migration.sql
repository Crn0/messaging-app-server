-- CreateTable
CREATE TABLE "ChatRoleCounters" (
    "chat_pk" INTEGER NOT NULL,
    "last_level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChatRoleCounters_pkey" PRIMARY KEY ("chat_pk")
);

-- AddForeignKey
ALTER TABLE "ChatRoleCounters" ADD CONSTRAINT "ChatRoleCounters_chat_pk_fkey" FOREIGN KEY ("chat_pk") REFERENCES "Chats"("pk") ON DELETE CASCADE ON UPDATE CASCADE;
