import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { SearchService } from './search.service';

// UUID v1-v5 regex (case-insensitive). Used to validate filter ids
// before they're interpolated into raw SQL — otherwise a malformed
// id becomes a runtime Postgres error which the catch block swallows,
// returning a silent empty result (H-B3, H-B6).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PostgresSearchService extends SearchService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async search(
    query: string,
    options?: { limit?: number; offset?: number; categoryId?: string; collectionId?: string },
  ): Promise<{ products: Product[]; total: number }> {
    const limit = Math.min(Math.max(options?.limit || 20, 1), 50);
    const offset = Math.min(Math.max(options?.offset || 0, 0), 10000);
    const { categoryId, collectionId } = options || {};

    if (query && query.length > 200) {
      throw new BadRequestException('Search query is too long (maximum 200 characters)');
    }

    const cleanQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!cleanQuery) {
      return { products: [], total: 0 };
    }

    // H-B3 fix: validate that filter ids are real UUIDs before splicing
    // them into the raw SQL. Postgres would otherwise throw a 22P02
    // "invalid input syntax for type uuid" which the catch block below
    // would silently swallow, returning an empty result set and hiding
    // the real bug from the caller.
    if (categoryId && !UUID_RE.test(categoryId)) {
      throw new BadRequestException('Invalid categoryId: must be a UUID');
    }
    if (collectionId && !UUID_RE.test(collectionId)) {
      throw new BadRequestException('Invalid collectionId: must be a UUID');
    }

    const formattedQuery = cleanQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(' & ');

    let categoryFilter = Prisma.empty;
    let collectionFilter = Prisma.empty;

    if (categoryId) {
      categoryFilter = Prisma.sql`AND p.category_id = ${categoryId}::uuid`;
    }

    if (collectionId) {
      collectionFilter = Prisma.sql`AND p.id IN (SELECT "B" FROM "_ProductCollections" WHERE "A" = ${collectionId}::uuid)`;
    }

    // H-B9 fix: a single shared WHERE clause used by both the rows and
    // the count query so the two cannot drift apart. If one of these is
    // edited, both must be edited together — the shared snippet makes
    // that obvious at review time.
    const whereClause = Prisma.sql`
      p.status = 'PUBLISHED'
        AND p.is_deleted = false
        AND (p.drop_id IS NULL OR p.drop_id IN (SELECT id FROM drops WHERE release_date <= NOW() OR is_active = true))
        ${categoryFilter}
        ${collectionFilter}
        AND (
          to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '') || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', ${formattedQuery})
          OR word_similarity(${cleanQuery}, p.title) > 0.5
        )
    `;

    const searchSql = Prisma.sql`
      SELECT *, (fts_rank * 0.7 + trigram_rank * 0.3) as search_rank
      FROM (
        SELECT p.*,
          ts_rank(
            setweight(to_tsvector('english', coalesce(p.title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(array_to_string(p.tags, ' '), '')), 'B') ||
            setweight(to_tsvector('english', coalesce(p.description, '')), 'C'),
            to_tsquery('english', ${formattedQuery})
          ) as fts_rank,
          word_similarity(${cleanQuery}, p.title) as trigram_rank
        FROM products p
        WHERE ${whereClause}
      ) sub
      ORDER BY search_rank DESC, sub.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const products = await this.prisma.$queryRaw<Product[]>(searchSql);

      // Fetch missing variants to prevent stale UI in search results
      const productIds = products.map((p) => p.id);
      if (productIds.length > 0) {
        const variants = await this.prisma.productVariant.findMany({
          where: { productId: { in: productIds }, isDeleted: false },
        });
        const variantsMap = new Map<string, unknown[]>();
        for (const v of variants) {
          if (!variantsMap.has(v.productId)) variantsMap.set(v.productId, []);
          variantsMap.get(v.productId)!.push(v);
        }
        for (const p of products) {
          (p as any).variants = variantsMap.get(p.id) || [];
        }
      }

      const countSql = Prisma.sql`
        SELECT COUNT(*)::int as count
          FROM products p
         WHERE ${whereClause}
      `;
      const countResult = await this.prisma.$queryRaw<{ count: number }[]>(countSql);
      const total = Number(countResult[0]?.count) || 0;

      return { products, total };
    } catch (e) {
      // Surface unexpected errors via the logger; previously this catch
      // silently returned empty results, hiding real bugs (H-B3 follow-up).
      // Logged rather than thrown so a transient DB hiccup doesn't 500
      // the whole search endpoint, but the log entry makes it observable.
      console.warn('[PostgresSearchService] search query failed:', (e as Error).message);
      return { products: [], total: 0 };
    }
  }
}
