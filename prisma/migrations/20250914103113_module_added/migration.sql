/*
  Warnings:

  - You are about to drop the column `lessonId` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `course_modules` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `course_modules` table. All the data in the column will be lost.
  - You are about to drop the `course_lessons` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lesson_assets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lesson_progress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `teacher_profiles` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `moduleClassId` to the `assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `module_name` to the `course_modules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `module_title` to the `course_modules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "course_lessons" DROP CONSTRAINT "course_lessons_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_assets" DROP CONSTRAINT "lesson_assets_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "teacher_profiles" DROP CONSTRAINT "teacher_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "lessonId",
ADD COLUMN     "moduleClassId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "course_modules" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "module_name" TEXT NOT NULL,
ADD COLUMN     "module_overview" TEXT,
ADD COLUMN     "module_title" TEXT NOT NULL;

-- DropTable
DROP TABLE "course_lessons";

-- DropTable
DROP TABLE "lesson_assets";

-- DropTable
DROP TABLE "lesson_progress";

-- DropTable
DROP TABLE "teacher_profiles";

-- CreateTable
CREATE TABLE "module_classes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "class_title" TEXT NOT NULL,
    "class_name" TEXT,
    "class_overview" TEXT,
    "duration" TEXT,
    "start_date" TIMESTAMP(3),
    "class_time" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_assets" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "class_id" TEXT NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "asset_url" TEXT NOT NULL,

    CONSTRAINT "class_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "attended_at" TIMESTAMP(3),

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendances_class_id_student_id_key" ON "attendances"("class_id", "student_id");

-- AddForeignKey
ALTER TABLE "module_classes" ADD CONSTRAINT "module_classes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_moduleClassId_fkey" FOREIGN KEY ("moduleClassId") REFERENCES "module_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assets" ADD CONSTRAINT "class_assets_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "module_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "module_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
