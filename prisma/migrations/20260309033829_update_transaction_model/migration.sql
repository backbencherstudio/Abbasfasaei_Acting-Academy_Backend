-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "payment_type" "public"."PaymentType" NOT NULL DEFAULT 'ONE_TIME';
