/*
  Warnings:

  - The values [ONE_TIME,MONTHLY_INSTALLMENTS] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `address` to the `enrollment_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `enrollment_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `experience_level` to the `enrollment_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `enrollment_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `enrollment_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PENDING', 'ALUMNI');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentType_new" AS ENUM ('MONTHLY', 'YEARLY');
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_type" TYPE "PaymentType_new" USING ("payment_type"::text::"PaymentType_new");
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "PaymentType_old";
COMMIT;

-- AlterTable
ALTER TABLE "enrollment_profiles" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "enrollment_status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "experience_level" "ExperienceLevel" NOT NULL,
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "contract_docs" JSONB,
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING';
