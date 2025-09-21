-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('APPROVED', 'REQUEST', 'REJECTED', 'FLAQ', 'ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'REQUEST';
