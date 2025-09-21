/*
  Warnings:

  - The values [PDF] on the enum `AssetType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssetType_new" AS ENUM ('VIDEO', 'PHOTO', 'FILE');
ALTER TABLE "class_assets" ALTER COLUMN "asset_type" TYPE "AssetType_new" USING ("asset_type"::text::"AssetType_new");
ALTER TYPE "AssetType" RENAME TO "AssetType_old";
ALTER TYPE "AssetType_new" RENAME TO "AssetType";
DROP TYPE "AssetType_old";
COMMIT;
