-- AlterTable
ALTER TABLE "assignment_grades" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "assignment_submissions" ADD COLUMN     "submitted" BOOLEAN NOT NULL DEFAULT false;
