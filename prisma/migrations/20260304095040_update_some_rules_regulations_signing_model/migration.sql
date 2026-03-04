/*
  Warnings:

  - You are about to drop the column `enrollmentId` on the `digital_signatures` table. All the data in the column will be lost.
  - You are about to drop the column `billing_id` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[digital_contract_signing_id]` on the table `digital_signatures` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rules_regulations_signing_id]` on the table `digital_signatures` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PARTIAL_PAID';

-- AlterEnum
ALTER TYPE "public"."PaymentGateway" ADD VALUE 'MANUAL_BANK_TRANSFER';

-- DropIndex
DROP INDEX "public"."digital_signatures_enrollmentId_key";

-- AlterTable
ALTER TABLE "public"."digital_signatures" DROP COLUMN "enrollmentId";

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "billing_id",
ADD COLUMN     "customer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "digital_signatures_digital_contract_signing_id_key" ON "public"."digital_signatures"("digital_contract_signing_id");

-- CreateIndex
CREATE UNIQUE INDEX "digital_signatures_rules_regulations_signing_id_key" ON "public"."digital_signatures"("rules_regulations_signing_id");
