-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUND_INITIATED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('INITIATED', 'PROCESSED', 'FAILED');

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "creator_templates" DROP CONSTRAINT "creator_templates_user_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_id_fkey";

-- DropForeignKey
ALTER TABLE "studio_designs" DROP CONSTRAINT "studio_designs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "studio_status_histories" DROP CONSTRAINT "studio_status_histories_user_id_fkey";

-- DropIndex
DROP INDEX "assets_storage_key_idx";

-- DropIndex
DROP INDEX "cart_items_cart_id_idx";

-- DropIndex
DROP INDEX "carts_session_id_idx";

-- DropIndex
DROP INDEX "carts_user_id_idx";

-- DropIndex
DROP INDEX "design_versions_design_id_idx";

-- DropIndex
DROP INDEX "orders_user_id_idx";

-- DropIndex
DROP INDEX "products_description_trgm_idx";

-- DropIndex
DROP INDEX "products_tags_gin_idx";

-- DropIndex
DROP INDEX "products_title_trgm_idx";

-- DropIndex
DROP INDEX "wishlist_items_wishlist_id_idx";

-- DropIndex
DROP INDEX "wishlists_user_id_idx";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "product_sku" TEXT,
ADD COLUMN     "product_thumbnail" TEXT,
ADD COLUMN     "product_title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "low_stock_threshold" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "customizable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "mrp" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "studio_designs" DROP COLUMN "deleted_at",
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "two_factor_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" TEXT;

-- CreateTable
CREATE TABLE "global_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recently_viewed" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "pickup_scheduled_at" TIMESTAMP(3),
    "refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_status_histories" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "old_status" "ReturnStatus",
    "new_status" "ReturnStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "razorpay_refund_id" TEXT,
    "amount_in_paise" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'INITIATED',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_zones" (
    "id" TEXT NOT NULL,
    "pincode_prefix" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "eta_min_days" INTEGER NOT NULL,
    "eta_max_days" INTEGER NOT NULL,
    "cod_available" BOOLEAN NOT NULL DEFAULT true,
    "state" TEXT NOT NULL,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restock_notifications" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "restock_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_submissions_status_idx" ON "contact_submissions"("status");

-- CreateIndex
CREATE INDEX "contact_submissions_created_at_idx" ON "contact_submissions"("created_at");

-- CreateIndex
CREATE INDEX "recently_viewed_user_id_viewed_at_idx" ON "recently_viewed"("user_id", "viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_user_id_product_id_key" ON "recently_viewed"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_order_item_id_key" ON "return_requests"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_refund_id_key" ON "return_requests"("refund_id");

-- CreateIndex
CREATE INDEX "return_requests_order_id_idx" ON "return_requests"("order_id");

-- CreateIndex
CREATE INDEX "return_requests_user_id_idx" ON "return_requests"("user_id");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- CreateIndex
CREATE INDEX "return_status_histories_return_id_idx" ON "return_status_histories"("return_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_razorpay_refund_id_key" ON "refunds"("razorpay_refund_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_zones_pincode_prefix_key" ON "logistics_zones"("pincode_prefix");

-- CreateIndex
CREATE INDEX "logistics_zones_zone_idx" ON "logistics_zones"("zone");

-- CreateIndex
CREATE INDEX "restock_notifications_variant_id_idx" ON "restock_notifications"("variant_id");

-- CreateIndex
CREATE INDEX "restock_notifications_is_notified_idx" ON "restock_notifications"("is_notified");

-- CreateIndex
CREATE UNIQUE INDEX "restock_notifications_variant_id_email_key" ON "restock_notifications"("variant_id", "email");

-- CreateIndex
CREATE INDEX "collections_is_active_idx" ON "collections"("is_active");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "drops_is_active_idx" ON "drops"("is_active");

-- CreateIndex
CREATE INDEX "drops_release_date_idx" ON "drops"("release_date");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "order_status_histories_changed_by_idx" ON "order_status_histories"("changed_by");

-- CreateIndex
CREATE INDEX "orders_user_id_status_created_at_idx" ON "orders"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_shipping_email_status_idx" ON "orders"("shipping_email", "status");

-- CreateIndex
CREATE INDEX "product_variants_is_deleted_idx" ON "product_variants"("is_deleted");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_is_deleted_idx" ON "products"("is_deleted");

-- CreateIndex
CREATE INDEX "products_is_featured_idx" ON "products"("is_featured");

-- CreateIndex
CREATE INDEX "reviews_is_approved_idx" ON "reviews"("is_approved");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "studio_designs_status_idx" ON "studio_designs"("status");

-- CreateIndex
CREATE INDEX "studio_submissions_status_idx" ON "studio_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_designs" ADD CONSTRAINT "studio_designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_templates" ADD CONSTRAINT "creator_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_status_histories" ADD CONSTRAINT "studio_status_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_status_histories" ADD CONSTRAINT "return_status_histories_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_notifications" ADD CONSTRAINT "restock_notifications_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

