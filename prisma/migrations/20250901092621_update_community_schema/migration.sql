/*
  Warnings:

  - You are about to drop the `_community_Posts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_community_Posts" DROP CONSTRAINT "_community_Posts_A_fkey";

-- DropForeignKey
ALTER TABLE "_community_Posts" DROP CONSTRAINT "_community_Posts_B_fkey";

-- DropTable
DROP TABLE "_community_Posts";
