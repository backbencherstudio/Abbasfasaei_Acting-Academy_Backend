/*
  Warnings:

  - You are about to drop the column `course` on the `Enrollment` table. All the data in the column will be lost.
  - Added the required column `course_type` to the `Enrollment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "course",
ADD COLUMN     "course_type" "CourseType" NOT NULL;
