/*
  Warnings:

  - You are about to drop the column `actingGoalsId` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `actingGoalsId` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "actingGoalsId",
ADD COLUMN     "acting_Goals_Id" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "actingGoalsId",
ADD COLUMN     "acting_Goals_Id" TEXT;
