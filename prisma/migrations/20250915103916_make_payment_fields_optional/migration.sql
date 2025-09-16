-- AlterTable
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_type" DROP NOT NULL,
ALTER COLUMN "payment_method" DROP NOT NULL,
ALTER COLUMN "invoice_sent" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "payment_date" DROP NOT NULL,
ALTER COLUMN "transaction_id" DROP NOT NULL;
