-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "EnrollmentPayment" ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
