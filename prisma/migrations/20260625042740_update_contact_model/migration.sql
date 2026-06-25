/*
  Warnings:

  - You are about to drop the column `first_name` on the `contacts` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `contacts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."contacts" DROP COLUMN "first_name",
DROP COLUMN "last_name",
ADD COLUMN     "name" TEXT,
ADD COLUMN     "reason" TEXT;
