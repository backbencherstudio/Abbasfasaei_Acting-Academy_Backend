-- AlterTable
ALTER TABLE "payment_histories" ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "currency" TEXT DEFAULT 'USD',
ADD COLUMN     "payment_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "payment_type" "PaymentType",
ADD COLUMN     "transaction_id" TEXT;
