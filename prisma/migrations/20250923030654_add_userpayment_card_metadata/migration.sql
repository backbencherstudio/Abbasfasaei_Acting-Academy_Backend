-- AlterTable
ALTER TABLE "enrollment_payments" ADD COLUMN     "card_brand" TEXT,
ADD COLUMN     "card_exp_month" INTEGER,
ADD COLUMN     "card_exp_year" INTEGER,
ADD COLUMN     "card_last4" TEXT,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "invoice_url" TEXT,
ADD COLUMN     "payment_method_id" TEXT,
ADD COLUMN     "provider" TEXT DEFAULT 'STRIPE';
