-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "acting_goals" TEXT,
ADD COLUMN     "experience_levels" "ExperienceLevel"[];
