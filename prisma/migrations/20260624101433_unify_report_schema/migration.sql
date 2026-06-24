/*
  Warnings:

  - You are about to drop the column `message_id` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the `user_reports` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `reports` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_message_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_reports" DROP CONSTRAINT "user_reports_reported_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_reports" DROP CONSTRAINT "user_reports_reporter_id_fkey";

-- DropIndex
DROP INDEX "public"."reports_message_id_idx";

-- AlterTable
ALTER TABLE "public"."reports" DROP COLUMN "message_id",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "reported_message_id" TEXT,
ADD COLUMN     "reported_post_id" TEXT,
ADD COLUMN     "reported_user_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."user_reports";

-- CreateIndex
CREATE INDEX "reports_reported_user_id_idx" ON "public"."reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "reports_reported_message_id_idx" ON "public"."reports"("reported_message_id");

-- CreateIndex
CREATE INDEX "reports_reported_post_id_idx" ON "public"."reports"("reported_post_id");

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reported_message_id_fkey" FOREIGN KEY ("reported_message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reported_post_id_fkey" FOREIGN KEY ("reported_post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
