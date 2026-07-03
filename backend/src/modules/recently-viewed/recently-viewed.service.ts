import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

const MAX_PER_USER = 50;

/**
 * RecentlyViewedService — Phase 2 (audit item 2.1).
 *
 * Records product views for authenticated users so the "recently viewed"
 * list syncs across devices. Anonymous users still rely on the frontend
 * Zustand+localStorage store (see src/lib/store/recently-viewed.ts);
 * on login, the auth store calls `mergeAnonymousViews` to flush the
 * local list into this table.
 */
@Injectable()
export class RecentlyViewedService {
  private readonly logger = new Logger(RecentlyViewedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a single product view. Uses upsert on (userId, productId)
   * so re-viewing the same product just bumps viewedAt to now.
   */
  async track(userId: string, productId: string) {
    return this.prisma.recentlyViewed.upsert({
      where: { userId_productId: { userId, productId } },
      update: { viewedAt: new Date() },
      create: { userId, productId },
      select: { id: true, viewedAt: true },
    });
  }

  /**
   * Merge anonymous (localStorage) views into the backend on login.
   * Upserts each product; existing rows just get their viewedAt bumped.
   */
  async mergeAnonymousViews(userId: string, productIds: string[]) {
    if (productIds.length === 0) return { merged: 0 };

    const unique = Array.from(new Set(productIds)).slice(0, MAX_PER_USER);
    let merged = 0;
    // Per-row upsert keeps this idempotent and avoids the unique-constraint
    // race that a single createMany would hit on re-merge.
    for (const productId of unique) {
      try {
        await this.prisma.recentlyViewed.upsert({
          where: { userId_productId: { userId, productId } },
          update: { viewedAt: new Date() },
          create: { userId, productId },
        });
        merged += 1;
      } catch (err) {
        // A productId may not exist (e.g. product was deleted). Skip silently
        // — the FK violation is the only realistic cause and isn't worth
        // surfacing to the user during a login merge.
        this.logger.warn(
          `Skip productId=${productId} during merge for userId=${userId}: ${(err as Error).message}`,
        );
      }
    }
    return { merged };
  }

  /**
   * Most-recent N products the user has viewed. Joins the catalog for
   * enough fields to render ProductCards without an extra round trip.
   */
  async list(userId: string, limit = 12) {
    const rows = await this.prisma.recentlyViewed.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: Math.min(limit, MAX_PER_USER),
      include: {
        user: false, // suppress the user payload in the response
      },
    });
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.productId);
    const variants = await this.prisma.productVariant.findMany({
      where: { productId: { in: ids } },
      select: {
        id: true,
        productId: true,
        sku: true,
        size: true,
        color: true,
        stockQuantity: true,
        priceOverride: true,
        thumbnailUrl: true,
        mediaUrls: true,
      },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isDeleted: false, status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        title: true,
        basePrice: true,
        mrp: true,
        mediaUrls: true,
        tags: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    return rows
      .map((r) => {
        const p = productMap.get(r.productId);
        if (!p) return null;
        return {
          viewedAt: r.viewedAt,
          product: {
            id: p.id,
            slug: p.slug,
            title: p.title,
            basePrice: Number(p.basePrice),
            mrp: p.mrp != null ? Number(p.mrp) : null,
            mediaUrls: p.mediaUrls,
            tags: p.tags,
            variants: variantsByProduct.get(p.id) ?? [],
          },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  async clear(userId: string) {
    await this.prisma.recentlyViewed.deleteMany({ where: { userId } });
    return { cleared: true };
  }
}
