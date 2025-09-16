/*
  Warnings:

  - The values [PENDING,COMPLETED,FAILED,REFUNDED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PAID', 'DUE', 'OVER_DUE');
-- Drop defaults before converting types
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "payment_histories" ALTER COLUMN "payment_status" DROP DEFAULT;

-- Convert existing values with explicit mapping to avoid invalid casts
ALTER TABLE "enrollment_payments"
    ALTER COLUMN "payment_status" TYPE "PaymentStatus_new"
    USING (
        CASE "payment_status"
            WHEN 'PENDING'   THEN 'DUE'
            WHEN 'COMPLETED' THEN 'PAID'
            WHEN 'FAILED'    THEN 'DUE'
            WHEN 'REFUNDED'  THEN 'DUE'
            ELSE 'DUE'
        END
    )::"PaymentStatus_new";

ALTER TABLE "payment_histories"
    ALTER COLUMN "payment_status" TYPE "PaymentStatus_new"
    USING (
        CASE "payment_status"
            WHEN 'PENDING'   THEN 'DUE'
            WHEN 'COMPLETED' THEN 'PAID'
            WHEN 'FAILED'    THEN 'DUE'
            WHEN 'REFUNDED'  THEN 'DUE'
            ELSE 'DUE'
        END
    )::"PaymentStatus_new";

-- Rename types
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";

-- Restore defaults
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_status" SET DEFAULT 'DUE';
ALTER TABLE "payment_histories" ALTER COLUMN "payment_status" SET DEFAULT 'DUE';
COMMIT;

-- AlterTable
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_status" SET DEFAULT 'DUE';

-- AlterTable
-- Add column on enrollments after the enum change
ALTER TABLE "enrollments" 
    ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'DUE',
    ADD COLUMN IF NOT EXISTS "payment_type" "PaymentType";

-- AlterTable
ALTER TABLE "payment_histories" ALTER COLUMN "payment_status" SET DEFAULT 'DUE';

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "overview" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "files" JSONB,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_members" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_payments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT DEFAULT 'USD',
    "status" "EventPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "payment_method" TEXT,
    "payment_date" TIMESTAMP(3),
    "receipt_file" TEXT,
    "invoice_file" TEXT,
    "transaction_ref" TEXT,

    CONSTRAINT "event_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_members_event_id_user_id_key" ON "event_members"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_payments_event_id_user_id_key" ON "event_payments"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "event_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
