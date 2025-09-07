-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "date_of_birth" DROP NOT NULL,
ALTER COLUMN "date_of_birth" SET DATA TYPE DATE;
