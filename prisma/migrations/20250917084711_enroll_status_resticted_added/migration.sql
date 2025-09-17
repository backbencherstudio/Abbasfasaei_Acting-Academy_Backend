/*
  Warnings:

  - You are about to drop the column `role` on the `enrollments` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'RESTRICTED';

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "role";
