/*
  Warnings:

  - You are about to drop the column `description` on the `courses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "description",
ADD COLUMN     "course_module_details" JSONB,
ADD COLUMN     "course_overview" TEXT;

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "teacher_name" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "bio" TEXT,
    "qualifications" TEXT,
    "experience" TEXT,
    "specialties" TEXT,
    "availability" TEXT,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
