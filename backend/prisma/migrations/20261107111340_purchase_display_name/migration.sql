-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "displayName" TEXT NOT NULL DEFAULT '';


-- Backfill: old rows only have the lowercased key
UPDATE "Purchase" SET "displayName" = "name" WHERE "displayName" = '';
