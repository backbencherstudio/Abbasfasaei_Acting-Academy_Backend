/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `assignments` table. All the data in the column will be lost.
  - Added the required column `teacherId` to the `assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "updatedAt",
ADD COLUMN     "average_score" INTEGER DEFAULT 0,
ADD COLUMN     "teacherId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
