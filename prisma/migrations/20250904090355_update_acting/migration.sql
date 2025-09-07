/*
  Warnings:

  - You are about to drop the column `acting_Goals_Id` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `acting_Goals_Id` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "acting_Goals_Id",
ADD COLUMN     "actingGoalsId" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "acting_Goals_Id",
ADD COLUMN     "actingGoalsId" TEXT;
