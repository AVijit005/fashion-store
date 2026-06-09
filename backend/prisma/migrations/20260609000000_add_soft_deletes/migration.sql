-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
