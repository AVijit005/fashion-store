import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ProductStatus, Prisma } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCollections() {
    return this.prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProducts(filters: {
    categorySlug?: string;
    collectionSlug?: string;
    isFeatured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const now = new Date();

    // Visibility boundary: must be PUBLISHED, and if linked to a drop, the drop must be released/active
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      OR: [
        { dropId: null },
        {
          drop: {
            OR: [{ releaseDate: { lte: now } }, { isActive: true }],
          },
        },
      ],
    };

    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }

    if (filters.collectionSlug) {
      where.collections = {
        some: { slug: filters.collectionSlug, isActive: true },
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              stockQuantity: true,
              priceOverride: true,
              mediaUrls: true,
              thumbnailUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
    };
  }

  async getProductBySlug(slug: string) {
    const now = new Date();
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        OR: [
          { dropId: null },
          {
            drop: {
              OR: [{ releaseDate: { lte: now } }, { isActive: true }],
            },
          },
        ],
      },
      include: {
        category: true,
        collections: true,
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stockQuantity: true,
            priceOverride: true,
            mediaUrls: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found or not yet available');
    }

    return product;
  }

  async getActiveDrops() {
    return this.prisma.drop.findMany({
      orderBy: { releaseDate: 'asc' },
    });
  }
}
