/*
  Warnings:

  - You are about to drop the column `experience_levels` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "experience_levels",
ADD COLUMN     "experience_level" "ExperienceLevel";
