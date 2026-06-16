import { Injectable, BadRequestException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { SearchService } from './search.service';

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

    const formattedQuery = cleanQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(' & ');

    let categoryFilter = '';
    let collectionFilter = '';
    const params: (string | number)[] = [];

    if (categoryId) {
      params.push(categoryId);
      categoryFilter = `AND p.category_id = $${params.length}`;
    }

    if (collectionId) {
      params.push(collectionId);
      collectionFilter = `AND p.id IN (SELECT "B" FROM "_ProductCollections" WHERE "A" = $${params.length})`;
    }

    params.push(formattedQuery);
    const ftsParamIndex = params.length;

    params.push(cleanQuery);
    const trigramParamIndex = params.length;

    const searchSql = `
      SELECT *, (fts_rank * 0.7 + trigram_rank * 0.3) as search_rank
      FROM (
        SELECT p.*, 
          ts_rank(
            setweight(to_tsvector('english', coalesce(p.title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(array_to_string(p.tags, ' '), '')), 'B') ||
            setweight(to_tsvector('english', coalesce(p.description, '')), 'C'),
            to_tsquery('english', $${ftsParamIndex})
          ) as fts_rank,
          word_similarity($${trigramParamIndex}, p.title) as trigram_rank
        FROM products p
        WHERE p.status = 'PUBLISHED'
          AND p.is_deleted = false
          AND (p.drop_id IS NULL OR p.drop_id IN (SELECT id FROM drops WHERE release_date <= NOW() OR is_active = true))
          ${categoryFilter}
          ${collectionFilter}
          AND (
            to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '') || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', $${ftsParamIndex})
            OR word_similarity($${trigramParamIndex}, p.title) > 0.5
          )
      ) sub
      ORDER BY search_rank DESC, sub.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const products = await this.prisma.$queryRawUnsafe<Product[]>(searchSql, ...params);

      // Fix High Severity: Fetch missing variants to prevent stale UI in search results
      const productIds = products.map((p) => p.id);
      if (productIds.length > 0) {
        const variants = await this.prisma.productVariant.findMany({
          where: { productId: { in: productIds }, isDeleted: false },
        });
        const variantsMap = new Map();
        for (const v of variants) {
          if (!variantsMap.has(v.productId)) variantsMap.set(v.productId, []);
          variantsMap.get(v.productId).push(v);
        }
        for (const p of products) {
          (p as any).variants = variantsMap.get(p.id) || [];
        }
      }
      const countSql = `
        SELECT COUNT(*)::int as count
        FROM products p
        WHERE p.status = 'PUBLISHED'
          AND p.is_deleted = false
          AND (p.drop_id IS NULL OR p.drop_id IN (SELECT id FROM drops WHERE release_date <= NOW() OR is_active = true))
          ${categoryFilter}
          ${collectionFilter}
          AND (
            to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '') || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', $${ftsParamIndex})
            OR word_similarity($${trigramParamIndex}, p.title) > 0.5
          )
      `;
      const countResult = await this.prisma.$queryRawUnsafe<{ count: number }[]>(countSql, ...params);
      const total = Number(countResult[0]?.count) || 0;

      return {
        products,
        total,
      };
    } catch (e) {
      console.warn('Search query failed:', e);
      return { products: [], total: 0 };
    }
  }
}
