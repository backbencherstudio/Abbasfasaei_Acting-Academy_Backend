/*
  Warnings:

  - You are about to drop the column `poolId` on the `CommunityPollVote` table. All the data in the column will be lost.
  - Added the required column `optionId` to the `CommunityPollVote` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."CommunityPollVote" DROP CONSTRAINT "CommunityPollVote_poolId_fkey";

-- AlterTable
ALTER TABLE "public"."CommunityPollVote" DROP COLUMN "poolId",
ADD COLUMN     "optionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."CommunityPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
