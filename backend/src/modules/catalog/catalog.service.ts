import { Injectable, NotFoundException } from '@nestjs/common';
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
    const now = new Date();
    return this.prisma.drop.findMany({
      where: {
        OR: [{ releaseDate: { lte: now } }, { isActive: true }],
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
    const PHOTO_IDS = [
      'photo-1550614000-4b95d466f2fb', 'photo-1523398002811-999aa8d9511e', 'photo-1539109136881-3be0616acf4b',
      'photo-1512436991641-6745cdb1723f', 'photo-1492288991661-058aa541ff43', 'photo-1552374196-1ab2a1c593e8',
      'photo-1529139574466-a303027c1d8b', 'photo-1487222477894-8943e31ef7b2', 'photo-1483985988355-763728e1935b',
      'photo-1503342217505-b0a15ec3261c', 'photo-1507680434267-3236ca9eece4', 'photo-1620799140408-edc6dcb6d633',
      'photo-1515886657613-9f3515b0c78f', 'photo-1551028719-00167b16eac5', 'photo-1517841905240-472988babdf9',
      'photo-1521572163474-6864f9cf17ab', 'photo-1556821840-3a63f95609a7', 'photo-1445205170230-053b83016050',
      'photo-1520975954732-57dd22299614', 'photo-1544441893-675973e31985', 'photo-1485231183945-fffde7cecebe',
      'photo-1581655353564-df123a1eb820', 'photo-1583743814966-8936f5b7be1a', 'photo-1554568218-0f1715e72254',
      'photo-1611312449408-fcece27cdbb1', 'photo-1578587018452-892bace03574', 'photo-1618354691373-d851c5c3a990',
      'photo-1529374255404-311a2a4f1fd9', 'photo-1469334031218-e382a71b716b', 'photo-1503341504253-dff4815485f1'
    ];
    const NOUNS = [
      { term: 'Oversized Hoodie', cat: 'hoodies' }, { term: 'Heavyweight Tee', cat: 'oversized-tees' },
      { term: 'Bomber Jacket', cat: 'jackets' }, { term: 'Denim Jacket', cat: 'jackets' },
      { term: 'Graphic Tee', cat: 'graphic-tees' }, { term: 'Trench Coat', cat: 'jackets' },
      { term: 'Vintage Tee', cat: 'graphic-tees' }, { term: 'Fleece Crew', cat: 'sweatshirts' },
      { term: 'Windbreaker', cat: 'jackets' }, { term: 'Capsule Jacket', cat: 'anime' },
      { term: 'Distressed Hoodie', cat: 'hoodies' }, { term: 'Utility Vest', cat: 'jackets' },
      { term: 'Boxy Tee', cat: 'oversized-tees' }, { term: 'Zip-Up Hoodie', cat: 'hoodies' },
      { term: 'Varsity Jacket', cat: 'jackets' }, { term: 'Cargo Jacket', cat: 'jackets' },
      { term: 'Mock Neck Crew', cat: 'sweatshirts' }, { term: 'Anime Collab Tee', cat: 'anime' },
      { term: 'Essential Tee', cat: 'oversized-tees' }, { term: 'Washed Hoodie', cat: 'hoodies' },
      { term: 'Matte Mobile Cover', cat: 'mobile-covers' }, { term: 'Armored Phone Case', cat: 'mobile-covers' },
      { term: 'Silicone Snap Case', cat: 'mobile-covers' }, { term: 'Ceramic Studio Mug', cat: 'mugs' },
      { term: 'Matte Black Mug', cat: 'mugs' }, { term: 'Heavyweight Canvas Tote', cat: 'tote-bags' },
      { term: 'Utility Tote Bag', cat: 'tote-bags' }, { term: 'Manifesto Poster', cat: 'posters' },
      { term: 'Editorial Art Print', cat: 'posters' }, { term: 'Archive Poster', cat: 'posters' }
    ];
    const ADJECTIVES = ['Monolith', 'Void', 'Shogun', 'Crimson', 'Phantom', 'Yurei', 'Noir', 'Ronin', 'Strata', 'Echo', 'Horizon', 'Akira', 'Vortex', 'Nebula', 'Urban', 'Onyx', 'Cobalt', 'Apex', 'Nomad', 'Zenith', 'Kinetics', 'Aura', 'Ethereal', 'Paradox', 'Nova', 'Cyber', 'Neon', 'Lunar', 'Solstice', 'Eclipse', 'Vector', 'Quantum', 'Glitch', 'Kitsune', 'Mecha', 'Samurai', 'Drift', 'Ascent', 'Rebel', 'Rogue'];
    const DESCRIPTIONS = [
      'Heavyweight 400gsm brushed fleece. Dropped shoulders, boxy fit, tonal embroidery.',
      '240gsm combed cotton. Garment-dyed for a lived-in feel and ultimate drape.',
      'Satin finish with intricate back embroidery. Premium hardware and ribbed trims.',
      'Overdyed 12oz denim. Cropped fit with raw hem detailing and silver hardware.',
      'Screen-printed vintage artwork on our signature washed cotton canvas.',
      'Cocoon silhouette in ultra-soft fleece. Features elongated drawstrings and hidden pockets.',
      'A modern, draped take on the classic trench. Water-resistant and incredibly sharp.',
      'Faded and distressed by hand. Features washed-out typography and dropped shoulders.',
      'Textured loopback fleece with a structured collar and paneled sleeves.',
      'Lightweight nylon shell. Technical design featuring utility pockets and mesh lining.',
      'Minimalist aesthetic. Premium weight cotton cut in an ultra-relaxed proportion.',
      'Neo-Tokyo inspired. High-collar mock neck jacket in technical water-repellent fabric.',
      'Sun-faded wash with hand-distressed edges. A vintage look that gets better with wear.',
      'Psychedelic back graphic print on washed black cotton.',
      'Tactical multi-pocket vest designed for layering over hoodies and tees.',
      'Garment washed for a vintage feel. Built to last through countless wears.',
      'Ultra-premium Japanese cotton blended with a touch of stretch for mobility.',
      'Architecturally structured with raw edges and subtle tonal branding.'
    ];
    const TAGS_POOL = ['oversized', 'bestseller', 'trending', 'new', 'limited', 'anime'];
    const PRODUCTS_MOCK: any[] = [];
    
    for (let i = 0; i < 250; i++) {
      const adj = ADJECTIVES[i % ADJECTIVES.length];
      const nounObj = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const title = `${adj} ${nounObj.term}`;
      const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '') + '-' + i;
      const desc = DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
      const price = Math.floor(Math.random() * (7000 - 1200 + 1) + 1200);
      const img1 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
      let img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
      while(img2 === img1) { img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)]; }
      const numTags = Math.floor(Math.random() * 3) + 1;
      const tags = [];
      for(let j=0; j<numTags; j++) tags.push(TAGS_POOL[Math.floor(Math.random() * TAGS_POOL.length)]);
      PRODUCTS_MOCK.push({
        slug, title, categorySlug: nounObj.cat, description: desc, price,
        imgIds: [img1, img2], tags: [...new Set(tags)], isFeatured: Math.random() > 0.8
      });
    }

    console.log('🌱 Seeding DB Natively...');
    // Explicitly delete related records to prevent foreign key constraint violations
    try {
      await this.prisma.$executeRawUnsafe(`DELETE FROM "cart_items"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "order_items"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "wishlist_items"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "reviews"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "product_variants"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "products"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "categories"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "collections"`);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "drops"`);
    } catch (e) {
      console.error('Error wiping db:', e);
    }

    const categoryMap = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const record = await this.prisma.category.create({ data: { name: cat.name, slug: cat.slug } });
      categoryMap.set(cat.slug, record.id);
    }
    await this.prisma.collection.create({
      data: { name: 'Summer Collection', slug: 'summer-collection', description: 'Lightweight styles for hot seasons', isActive: true },
    });
    const drop = await this.prisma.drop.create({
      data: { name: 'Anime Capsule Vol. 03', slug: 'anime-capsule-03', releaseDate: new Date(), isActive: true },
    });

    const productsToInsert = [];
    const variantsToInsert = [];

    for (const p of PRODUCTS_MOCK) {
      const categoryId = categoryMap.get(p.categorySlug);
      if (!categoryId) continue;
      const imageUrls = p.imgIds.map((id: string) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`);
      const productId = randomUUID();
      productsToInsert.push({
        id: productId,
        title: p.title, slug: p.slug, description: p.description, basePrice: p.price, isFeatured: p.isFeatured,
        mediaUrls: imageUrls, status: ProductStatus.PUBLISHED, categoryId, tags: p.tags,
        dropId: p.categorySlug === 'anime' ? drop.id : null,
      });

      const colors = COLORS.slice(0, 3);
      for (const color of colors) {
        for (const size of SIZES) {
          variantsToInsert.push({
            id: randomUUID(),
            productId: productId,
            sku: `${p.slug.toUpperCase().slice(0, 10)}-${color.name.toUpperCase().slice(0, 3)}-${size}-${randomUUID().slice(0,4)}`,
            size, color: color.name, stockQuantity: 50, mediaUrls: imageUrls, thumbnailUrl: imageUrls[0],
          });
        }
      }
    }

    await this.prisma.product.createMany({ data: productsToInsert });
    await this.prisma.productVariant.createMany({ data: variantsToInsert });
    
    return { success: true, count: productsToInsert.length, variants: variantsToInsert.length };
  }
}
