/*
  Warnings:

  - The values [LATE,EXCUSED] on the enum `AttendanceStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `grade` on the `assignment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_id` on the `event_members` table. All the data in the column will be lost.
  - Added the required column `submission_Date` to the `assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_marks` to the `assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AttendanceStatus_new" AS ENUM ('PRESENT', 'ABSENT');
ALTER TABLE "attendances" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attendances" ALTER COLUMN "status" TYPE "AttendanceStatus_new" USING ("status"::text::"AttendanceStatus_new");
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "AttendanceStatus_old";
ALTER TABLE "attendances" ALTER COLUMN "status" SET DEFAULT 'ABSENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "event_members" DROP CONSTRAINT "event_members_payment_id_fkey";

-- AlterTable
ALTER TABLE "assignment_submissions" DROP COLUMN "grade",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "total_Submissions" INTEGER DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "fileUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "dueDate",
ADD COLUMN     "attachment_url" JSONB,
ADD COLUMN     "submission_Date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "total_marks" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "attendance_by" TEXT;

-- AlterTable
ALTER TABLE "event_members" DROP COLUMN "payment_id";

-- CreateTable
CREATE TABLE "assignment_grades" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "grade_number" INTEGER NOT NULL,
    "feedback" TEXT,
    "gradedBy" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_graded" INTEGER DEFAULT 0,
    "submissionId" TEXT,

    CONSTRAINT "assignment_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_grades_submissionId_key" ON "assignment_grades"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_grades_assignmentId_studentId_key" ON "assignment_grades"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "assignment_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
