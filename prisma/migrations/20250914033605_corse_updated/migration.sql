/*
  Warnings:

  - The `course_overview` column on the `courses` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "course_overview",
ADD COLUMN     "course_overview" JSONB;
