/*
  Warnings:

  - You are about to drop the column `courseModuleId` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_type` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `IsPaymentCompleted` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `files` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `events` table. All the data in the column will be lost.
  - You are about to drop the `enrollment_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `enrollment_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_histories` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ticket_number]` on the table `event_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[payment_id]` on the table `event_members` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `payment_id` to the `event_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticket_number` to the `event_members` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."EnrollmentStep" AS ENUM ('DIGITAL_SIGNATURE_START', 'COURSE_SELECTION', 'FORM_FILLING', 'RULES_SIGNING', 'CONTRACT_SIGNING', 'PAYMENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('COURSE_ENROLLMENT', 'EVENT_TICKET');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PaymentGateway" AS ENUM ('STRIPE');

-- DropForeignKey
ALTER TABLE "public"."enrollment_payments" DROP CONSTRAINT "enrollment_payments_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."enrollment_payments" DROP CONSTRAINT "enrollment_payments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."enrollment_profiles" DROP CONSTRAINT "enrollment_profiles_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."event_payments" DROP CONSTRAINT "event_payments_event_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."event_payments" DROP CONSTRAINT "event_payments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payment_histories" DROP CONSTRAINT "payment_histories_userPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."payment_histories" DROP CONSTRAINT "payment_histories_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."enrollments" DROP COLUMN "courseModuleId",
DROP COLUMN "payment_status",
DROP COLUMN "payment_type",
ADD COLUMN     "step" "public"."EnrollmentStep" NOT NULL DEFAULT 'FORM_FILLING',
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."event_members" ADD COLUMN     "payment_id" TEXT NOT NULL,
ADD COLUMN     "ticket_number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."events" DROP COLUMN "IsPaymentCompleted",
DROP COLUMN "files",
DROP COLUMN "status";

-- DropTable
DROP TABLE "public"."enrollment_payments";

-- DropTable
DROP TABLE "public"."enrollment_profiles";

-- DropTable
DROP TABLE "public"."event_payments";

-- DropTable
DROP TABLE "public"."payment_histories";

-- DropEnum
DROP TYPE "public"."EventPaymentStatus";

-- DropEnum
DROP TYPE "public"."PaymentStatus";

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "paid_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "item_type" "public"."ItemType" NOT NULL,
    "payment_type" "public"."PaymentType" NOT NULL,
    "installment_amount" DECIMAL(65,30),
    "next_billing_date" TIMESTAMP(3),
    "stripe_subscription_id" TEXT,
    "notes" TEXT,
    "course_id" TEXT,
    "event_id" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "transaction_ref" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" "public"."PaymentGateway" NOT NULL DEFAULT 'STRIPE',
    "payment_method" TEXT,
    "card_last4" TEXT,
    "receipt_url" TEXT,
    "metadata" JSONB,
    "payment_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_number_key" ON "public"."payments"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_subscription_id_key" ON "public"."payments"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "public"."payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_ref_key" ON "public"."transactions"("transaction_ref");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "public"."transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_transaction_ref_idx" ON "public"."transactions"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_ticket_number_key" ON "public"."event_members"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_payment_id_key" ON "public"."event_members"("payment_id");

-- AddForeignKey
ALTER TABLE "public"."event_members" ADD CONSTRAINT "event_members_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
