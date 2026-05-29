-- AlterTable
ALTER TABLE "cart_items" ALTER COLUMN "product_variant_id" DROP NOT NULL,
ADD COLUMN "custom_data" JSONB;

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "product_variant_id" DROP NOT NULL,
ADD COLUMN "custom_data" JSONB;
