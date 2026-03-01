/*
  Warnings:

  - You are about to drop the `CommunityPool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommunityPoolVote` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('POST', 'POLL');

-- DropForeignKey
ALTER TABLE "public"."CommunityPool" DROP CONSTRAINT "CommunityPool_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommunityPoolVote" DROP CONSTRAINT "CommunityPoolVote_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommunityPoolVote" DROP CONSTRAINT "CommunityPoolVote_userId_fkey";

-- AlterTable
ALTER TABLE "public"."CommunityPost" ADD COLUMN     "post_type" "public"."PostType" NOT NULL DEFAULT 'POST';

-- DropTable
DROP TABLE "public"."CommunityPool";

-- DropTable
DROP TABLE "public"."CommunityPoolVote";

-- CreateTable
CREATE TABLE "public"."CommunityPollOption" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "CommunityPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommunityPollVote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CommunityPollVote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CommunityPollOption" ADD CONSTRAINT "CommunityPollOption_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "public"."CommunityPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
