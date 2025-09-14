/*
  Warnings:

  - You are about to drop the column `type` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `course_type` on the `enrollments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "course_type";
