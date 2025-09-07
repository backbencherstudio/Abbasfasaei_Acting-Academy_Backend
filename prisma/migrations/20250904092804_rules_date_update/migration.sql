-- AlterTable
ALTER TABLE "digital_signatures" ALTER COLUMN "signed_at" DROP NOT NULL,
ALTER COLUMN "signed_at" DROP DEFAULT;
