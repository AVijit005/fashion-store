import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ProductStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

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
    ids?: string[];
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const offset = Math.min(Math.max(filters.offset || 0, 0), 10000);
    const now = new Date();

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      OR: [
        { dropId: null },
        {
          drop: {
            isActive: true,
            releaseDate: { lte: now },
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

    if (filters.ids && filters.ids.length > 0) {
      if (filters.ids.length > 100) {
        throw new BadRequestException('Cannot fetch more than 100 products by ID at once');
      }
      where.id = { in: filters.ids };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: {
            where: { isDeleted: false },
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
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  async getProductBySlug(slug: string) {
    const now = new Date();
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        isDeleted: false,
        OR: [
          { dropId: null },
          {
            drop: {
              isActive: true,
              releaseDate: { lte: now },
            },
          },
        ],
      },
      include: {
        category: true,
        collections: true,
        variants: {
          where: { isDeleted: false },
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
    const now = new Date();
    return this.prisma.drop.findMany({
      where: {
        isActive: true,
        releaseDate: { lte: now },
      },
      orderBy: { releaseDate: 'asc' },
    });
  }

  async runSeed() {
    const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const COLORS = [
      { name: 'Bone', hex: '#f5f3ee' },
      { name: 'Fog', hex: '#e8e4dd' },
      { name: 'Graphite', hex: '#2d2d2d' },
      { name: 'Ink', hex: '#0d0d0d' },
      { name: 'Ember', hex: '#c84b1e' },
      { name: 'Forest', hex: '#2f4a3a' },
    ];
    const CATEGORIES = [
      { name: 'Oversized Tees', slug: 'oversized-tees' },
      { name: 'Graphic Tees', slug: 'graphic-tees' },
      { name: 'Hoodies', slug: 'hoodies' },
      { name: 'Sweatshirts', slug: 'sweatshirts' },
      { name: 'Jackets', slug: 'jackets' },
      { name: 'Anime', slug: 'anime' },
      { name: 'Mobile Covers', slug: 'mobile-covers' },
      { name: 'Mugs', slug: 'mugs' },
      { name: 'Tote Bags', slug: 'tote-bags' },
      { name: 'Posters', slug: 'posters' },
    ];
    const PRODUCTS_SEED = [
      {
        slug: 'monolith-oversized-hoodie',
        title: 'Monolith Oversized Hoodie',
        categorySlug: 'hoodies',
        description: 'Heavyweight 400gsm brushed fleece. Dropped shoulders, boxy fit, tonal embroidery.',
        price: 3500,
        imgIds: ['photo-1550614000-4b95d466f2fb', 'photo-1523398002811-999aa8d9511e'],
        tags: ['oversized', 'trending'],
        isFeatured: true,
      },
      {
        slug: 'void-heavyweight-tee',
        title: 'Void Heavyweight Tee',
        categorySlug: 'oversized-tees',
        description: '240gsm combed cotton. Garment-dyed for a lived-in feel and ultimate drape.',
        price: 2000,
        imgIds: ['photo-1539109136881-3be0616acf4b', 'photo-1512436991641-6745cdb1723f'],
        tags: ['bestseller'],
        isFeatured: false,
      },
      {
        slug: 'shogun-bomber-jacket',
        title: 'Shogun Bomber Jacket',
        categorySlug: 'jackets',
        description: 'Satin finish with intricate back embroidery. Premium hardware and ribbed trims.',
        price: 5500,
        imgIds: ['photo-1492288991661-058aa541ff43', 'photo-1552374196-1ab2a1c593e8'],
        tags: ['limited'],
        isFeatured: true,
      }
    ];

    console.log('🌱 Seeding DB Natively...');
    // Explicitly delete related records to prevent foreign key constraint violations
    try {
      await this.prisma.$executeRaw`DELETE FROM "cart_items"`;
      await this.prisma.$executeRaw`DELETE FROM "order_items"`;
      await this.prisma.$executeRaw`DELETE FROM "wishlist_items"`;
      await this.prisma.$executeRaw`DELETE FROM "reviews"`;
      await this.prisma.$executeRaw`DELETE FROM "product_variants"`;
      await this.prisma.$executeRaw`DELETE FROM "products"`;
      await this.prisma.$executeRaw`DELETE FROM "categories"`;
      await this.prisma.$executeRaw`DELETE FROM "collections"`;
      await this.prisma.$executeRaw`DELETE FROM "drops"`;
    } catch (e) {
      console.error('Error wiping db:', e);
    }

    const categoryMap = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const record = await this.prisma.category.create({
        data: { name: cat.name, slug: cat.slug },
      });
      categoryMap.set(cat.slug, record.id);
    }
    await this.prisma.collection.create({
      data: {
        name: 'Summer Collection',
        slug: 'summer-collection',
        description: 'Lightweight styles for hot seasons',
        isActive: true,
      },
    });
    const drop = await this.prisma.drop.create({
      data: {
        name: 'Anime Capsule Vol. 03',
        slug: 'anime-capsule-03',
        releaseDate: new Date(),
        isActive: true,
      },
    });

    const productsToInsert = [];
    const variantsToInsert = [];

    for (const p of PRODUCTS_SEED) {
      const categoryId = categoryMap.get(p.categorySlug);
      if (!categoryId) continue;
      const imageUrls = p.imgIds.map(
        (id: string) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`,
      );
      const productId = randomUUID();
      productsToInsert.push({
        id: productId,
        title: p.title,
        slug: p.slug,
        description: p.description,
        basePrice: p.price,
        isFeatured: p.isFeatured,
        mediaUrls: imageUrls,
        status: ProductStatus.PUBLISHED,
        categoryId,
        tags: p.tags,
        dropId: p.categorySlug === 'anime' ? drop.id : null,
      });

      const colors = COLORS.slice(0, 3);
      for (const color of colors) {
        for (const size of SIZES) {
          variantsToInsert.push({
            id: randomUUID(),
            productId: productId,
            sku: `${p.slug.toUpperCase().slice(0, 10)}-${color.name.toUpperCase().slice(0, 3)}-${size}-${randomUUID().slice(0, 4)}`,
            size,
            color: color.name,
            stockQuantity: 50,
            mediaUrls: imageUrls,
            thumbnailUrl: imageUrls[0],
          });
        }
      }
    }

    await this.prisma.product.createMany({ data: productsToInsert });
    await this.prisma.productVariant.createMany({ data: variantsToInsert });

    return { success: true, count: productsToInsert.length, variants: variantsToInsert.length };
  }
}
