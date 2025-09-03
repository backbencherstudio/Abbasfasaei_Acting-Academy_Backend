/*
  Warnings:

  - You are about to drop the `Community_Pool` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CommunityPoolVote" DROP CONSTRAINT "CommunityPoolVote_poolId_fkey";

-- DropForeignKey
ALTER TABLE "Community_Pool" DROP CONSTRAINT "Community_Pool_postId_fkey";

-- DropTable
DROP TABLE "Community_Pool";

-- CreateTable
CREATE TABLE "CommunityPool" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,

    CONSTRAINT "CommunityPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPool_postId_key" ON "CommunityPool"("postId");

-- AddForeignKey
ALTER TABLE "CommunityPool" ADD CONSTRAINT "CommunityPool_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPoolVote" ADD CONSTRAINT "CommunityPoolVote_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CommunityPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
