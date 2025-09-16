/*
  Warnings:

  - You are about to drop the column `userId` on the `enrollment_payments` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `enrollment_payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "enrollment_payments" DROP CONSTRAINT "enrollment_payments_userId_fkey";

-- AlterTable
ALTER TABLE "enrollment_payments" DROP COLUMN "userId",
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
