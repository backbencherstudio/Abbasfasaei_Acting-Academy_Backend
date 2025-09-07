/*
  Warnings:

  - You are about to drop the column `acknowledgedRules` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `agreed_contract` on the `Enrollment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "acknowledgedRules",
DROP COLUMN "agreed_contract";

-- CreateTable
CREATE TABLE "EnrollmentRules" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnrollmentRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentTermsAndConditions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnrollmentTermsAndConditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentRules_enrollmentId_key" ON "EnrollmentRules"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentTermsAndConditions_enrollmentId_key" ON "EnrollmentTermsAndConditions"("enrollmentId");

-- AddForeignKey
ALTER TABLE "EnrollmentRules" ADD CONSTRAINT "EnrollmentRules_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTermsAndConditions" ADD CONSTRAINT "EnrollmentTermsAndConditions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
