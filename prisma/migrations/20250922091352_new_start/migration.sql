-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "IsPaymentCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "IsPaymentCompleted" BOOLEAN NOT NULL DEFAULT false;
