import { PrismaService } from '../../src/config/prisma.service';

/**
 * Tables in dependency order for deletion (children before parents).
 * Keep in sync with prisma/schema.prisma.
 */
const TABLE_NAMES = [
  'webhook_events',
  'idempotency_keys',
  'order_status_histories',
  'order_items',
  'orders',
  'cart_items',
  'carts',
  'wishlist_items',
  'wishlists',
  'reviews',
  'audit_logs',
  'sessions',
  'addresses',
  'product_variants',
  'products',
  'categories',
  'collections',
  'drops',
  'assets',
  'studio_status_histories',
  'studio_submissions',
  'design_versions',
  'studio_designs',
  'creator_templates',
  'global_settings',
  'users',
];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  for (const table of TABLE_NAMES) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
    } catch (err) {
      // Ignore missing tables (e.g. if schema diverges)
      const message = (err as Error).message || '';
      if (!message.includes('does not exist')) {
        throw err;
      }
    }
  }
}
