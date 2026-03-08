/*
  Warnings:

  - You are about to drop the column `contract_docs` on the `enrollments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."enrollments" DROP COLUMN "contract_docs",
ADD COLUMN     "enrolled_documents" JSONB;
