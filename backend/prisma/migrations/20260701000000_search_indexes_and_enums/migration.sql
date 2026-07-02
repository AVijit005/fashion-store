-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS products_title_trgm_idx ON products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_description_trgm_idx ON products USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_tags_gin_idx ON products USING gin (tags);

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookEventStatus') THEN
        CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'IGNORED', 'FAILED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
        CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'COD');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'COD');
    END IF;
END $$;

-- Normalize any lowercase webhook statuses before switching to the enum.
UPDATE "webhook_events" SET "status" = UPPER("status") WHERE "status" IS NOT NULL;

-- AlterTable
ALTER TABLE "webhook_events" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "webhook_events" ALTER COLUMN "status" TYPE "WebhookEventStatus" USING ("status"::text::"WebhookEventStatus");
ALTER TABLE "webhook_events" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- Normalize any lowercase payment values before switching to enums.
UPDATE "orders" SET "payment_provider" = UPPER("payment_provider") WHERE "payment_provider" IS NOT NULL;
UPDATE "orders" SET "payment_status" = UPPER("payment_status") WHERE "payment_status" IS NOT NULL;

ALTER TABLE "orders" ALTER COLUMN "payment_provider" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "payment_provider" TYPE "PaymentProvider" USING ("payment_provider"::text::"PaymentProvider");
ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'RAZORPAY';

ALTER TABLE "orders" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "payment_status" TYPE "PaymentStatus" USING ("payment_status"::text::"PaymentStatus");
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';
