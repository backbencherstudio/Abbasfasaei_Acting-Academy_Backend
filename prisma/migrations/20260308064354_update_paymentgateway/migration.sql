/*
  Warnings:

  - The values [MANUAL_BANK_TRANSFER] on the enum `PaymentGateway` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."PaymentGateway_new" AS ENUM ('STRIPE', 'MANUAL_ENTRY');
ALTER TABLE "public"."transactions" ALTER COLUMN "gateway" DROP DEFAULT;
ALTER TABLE "public"."transactions" ALTER COLUMN "gateway" TYPE "public"."PaymentGateway_new" USING ("gateway"::text::"public"."PaymentGateway_new");
ALTER TYPE "public"."PaymentGateway" RENAME TO "PaymentGateway_old";
ALTER TYPE "public"."PaymentGateway_new" RENAME TO "PaymentGateway";
DROP TYPE "public"."PaymentGateway_old";
ALTER TABLE "public"."transactions" ALTER COLUMN "gateway" SET DEFAULT 'STRIPE';
COMMIT;
