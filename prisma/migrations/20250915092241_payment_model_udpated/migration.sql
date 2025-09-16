/*
  Warnings:

  - Added the required column `userId` to the `enrollment_payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "enrollment_payments" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
