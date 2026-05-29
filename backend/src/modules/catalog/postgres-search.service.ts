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
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
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
          AND (p.drop_id IS NULL OR p.drop_id IN (SELECT id FROM drops WHERE release_date <= NOW() OR is_active = true))
          ${categoryFilter}
          ${collectionFilter}
          AND (
            to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '') || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', $${ftsParamIndex})
            OR word_similarity($${trigramParamIndex}, p.title) > 0.5
          )
      ) sub
      ORDER BY search_rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const products = await this.prisma.$queryRawUnsafe<Product[]>(searchSql, ...params);

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM products p
      WHERE p.status = 'PUBLISHED'
        AND (p.drop_id IS NULL OR p.drop_id IN (SELECT id FROM drops WHERE release_date <= NOW() OR is_active = true))
        ${categoryFilter}
        ${collectionFilter}
        AND (
          to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '') || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', $${ftsParamIndex})
          OR word_similarity($${trigramParamIndex}, p.title) > 0.5
        )
    `;
    const countResult = await this.prisma.$queryRawUnsafe<{ count: number }[]>(countSql, ...params);
    const total = countResult[0]?.count || 0;

    return {
      products,
      total,
    };
  }
}
