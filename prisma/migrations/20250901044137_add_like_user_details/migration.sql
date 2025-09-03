-- AlterTable
ALTER TABLE "CommunityComment" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "CommunityLike" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "CommunityPool" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "CommunityPoolVote" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "CommunityShare" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT;
