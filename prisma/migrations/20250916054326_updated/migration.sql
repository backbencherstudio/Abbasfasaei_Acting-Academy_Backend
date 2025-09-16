/*
  Warnings:

  - You are about to drop the column `enrollment_payment_id` on the `payment_histories` table. All the data in the column will be lost.
  - You are about to drop the `payment_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_payment_methods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "payment_histories" DROP CONSTRAINT "payment_histories_enrollment_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_payment_methods" DROP CONSTRAINT "user_payment_methods_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "payment_histories" DROP COLUMN "enrollment_payment_id",
ADD COLUMN     "userPaymentId" TEXT;

-- DropTable
DROP TABLE "payment_transactions";

-- DropTable
DROP TABLE "user_payment_methods";

-- DropTable
DROP TABLE "user_profiles";

-- DropEnum
DROP TYPE "MembershipStatus";

-- AddForeignKey
ALTER TABLE "payment_histories" ADD CONSTRAINT "payment_histories_userPaymentId_fkey" FOREIGN KEY ("userPaymentId") REFERENCES "enrollment_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
