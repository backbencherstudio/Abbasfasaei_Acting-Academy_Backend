/*
  Warnings:

  - You are about to drop the `enrollment_contract_terms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "digital_signatures" DROP CONSTRAINT "digital_signatures_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_contract_terms" DROP CONSTRAINT "enrollment_contract_terms_enrollmentId_fkey";

-- AlterTable
ALTER TABLE "digital_signatures" ADD COLUMN     "digital_contract_signing_id" TEXT,
ADD COLUMN     "rules_regulations_signing_id" TEXT;

-- DropTable
DROP TABLE "enrollment_contract_terms";

-- CreateTable
CREATE TABLE "digital_contract_signings" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "digital_contract_signings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digital_contract_signings_enrollmentId_key" ON "digital_contract_signings"("enrollmentId");

-- AddForeignKey
ALTER TABLE "digital_contract_signings" ADD CONSTRAINT "digital_contract_signings_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_digital_contract_signing_id_fkey" FOREIGN KEY ("digital_contract_signing_id") REFERENCES "digital_contract_signings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_rules_regulations_signing_id_fkey" FOREIGN KEY ("rules_regulations_signing_id") REFERENCES "enrollment_terms_and_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
