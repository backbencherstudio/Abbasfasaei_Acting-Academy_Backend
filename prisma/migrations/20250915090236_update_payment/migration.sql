/*
  Warnings:

  - Added the required column `amount` to the `enrollment_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transaction_id` to the `enrollment_payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "enrollment_payments" ADD COLUMN     "amount" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "transaction_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STUDENT';
