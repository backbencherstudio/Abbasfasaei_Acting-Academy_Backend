/*
  Warnings:

  - You are about to drop the column `text` on the `notification_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."notification_events" DROP COLUMN "text",
ADD COLUMN     "content" TEXT,
ADD COLUMN     "title" TEXT;
