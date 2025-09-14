/*
  Warnings:

  - You are about to drop the column `installmentPlan` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_name` on the `teacher_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "installmentPlan",
ADD COLUMN     "installment_process" JSONB;

-- AlterTable
ALTER TABLE "teacher_profiles" DROP COLUMN "teacher_name",
ADD COLUMN     "instructor_name" TEXT;
