/*
  Warnings:

  - Made the column `course_overview` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `course_module_details` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `installment_process` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `class_time` on table `Course` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Course" ALTER COLUMN "course_overview" SET NOT NULL,
ALTER COLUMN "course_overview" SET DATA TYPE TEXT,
ALTER COLUMN "course_module_details" SET NOT NULL,
ALTER COLUMN "course_module_details" SET DATA TYPE TEXT,
ALTER COLUMN "installment_process" SET NOT NULL,
ALTER COLUMN "installment_process" SET DATA TYPE TEXT,
ALTER COLUMN "class_time" SET NOT NULL;
