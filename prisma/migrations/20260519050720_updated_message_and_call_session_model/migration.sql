/*
  Warnings:

  - You are about to drop the column `avatar_url` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `media_url` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `read_at` on the `messages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[conversation_id,user_id]` on the table `memberships` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."MessageKind" ADD VALUE 'CALL';

-- DropForeignKey
ALTER TABLE "public"."conversations" DROP CONSTRAINT "conversations_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_deleted_by_id_fkey";

-- DropIndex
DROP INDEX "public"."memberships_conversation_id_user_id_idx";

-- DropIndex
DROP INDEX "public"."memberships_user_id_conversation_id_key";

-- AlterTable
ALTER TABLE "public"."attachments" ADD COLUMN     "message_id" TEXT;

-- AlterTable
ALTER TABLE "public"."conversations" DROP COLUMN "avatar_url",
ADD COLUMN     "avatar" TEXT;

-- AlterTable
ALTER TABLE "public"."messages" DROP COLUMN "media_url",
DROP COLUMN "read_at",
ADD COLUMN     "call_session_id" TEXT,
ALTER COLUMN "content" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "memberships_conversation_id_user_id_key" ON "public"."memberships"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "public"."messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_reply_to_id_idx" ON "public"."messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "messages_call_session_id_idx" ON "public"."messages"("call_session_id");

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "public"."call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
