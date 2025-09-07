/*
  Warnings:

  - You are about to drop the `EnrollmentRules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EnrollmentRules" DROP CONSTRAINT "EnrollmentRules_enrollmentId_fkey";

-- DropTable
DROP TABLE "EnrollmentRules";

-- CreateTable
CREATE TABLE "EnrollmentContractTerms" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnrollmentContractTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentContractTerms_enrollmentId_key" ON "EnrollmentContractTerms"("enrollmentId");

-- AddForeignKey
ALTER TABLE "EnrollmentContractTerms" ADD CONSTRAINT "EnrollmentContractTerms_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
