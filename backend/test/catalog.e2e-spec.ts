import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/config/prisma.service';
import { ProductStatus } from '@prisma/client';

describe('CatalogController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup database
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.drop.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.drop.deleteMany({});

    // Seed test catalog structure
    const category = await prisma.category.create({
      data: { name: 'Hoodies', slug: 'hoodies' },
    });

    const activeCollection = await prisma.collection.create({
      data: { name: 'Summer Collection', slug: 'summer-collection', isActive: true },
    });

    const inactiveCollection = await prisma.collection.create({
      data: { name: 'Legacy Collection', slug: 'legacy-collection', isActive: false },
    });

    const futureDrop = await prisma.drop.create({
      data: {
        name: 'Winter Drop 2026',
        slug: 'winter-drop-2026',
        releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
        isActive: false,
      },
    });

    const pastDrop = await prisma.drop.create({
      data: {
        name: 'Spring Drop 2026',
        slug: 'spring-drop-2026',
        releaseDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day in past
        isActive: false,
      },
    });

    // 1. Regular published product (visible)
    const product1 = await prisma.product.create({
      data: {
        title: 'Aura Premium Hoodie',
        slug: 'aura-premium-hoodie',
        description: 'Heavyweight organic cotton streetwear hoodie',
        basePrice: 2999.0,
        status: ProductStatus.PUBLISHED,
        isFeatured: true,
        tags: ['streetwear', 'heavyweight', 'cotton'],
        categoryId: category.id,
        collections: { connect: { id: activeCollection.id } },
        variants: {
          createMany: {
            data: [
              {
                sku: 'AURA-HD-BLK-L',
                size: 'L',
                color: 'Black',
                stockQuantity: 15,
                mediaUrls: [
                  'https://cdn.aura.com/black-front.jpg',
                  'https://cdn.aura.com/black-back.jpg',
                ],
                thumbnailUrl: 'https://cdn.aura.com/black-thumb.jpg',
              },
              {
                sku: 'AURA-HD-RED-L',
                size: 'L',
                color: 'Red',
                stockQuantity: 5,
                priceOverride: 3499.0, // Variant-specific price override
                mediaUrls: ['https://cdn.aura.com/red-front.jpg'],
                thumbnailUrl: 'https://cdn.aura.com/red-thumb.jpg',
              },
            ],
          },
        },
      },
    });

    // 2. Draft product (hidden)
    await prisma.product.create({
      data: {
        title: 'Draft Sample Tee',
        slug: 'draft-sample-tee',
        description: 'Unreleased basic cotton t-shirt',
        basePrice: 999.0,
        status: ProductStatus.DRAFT,
        categoryId: category.id,
      },
    });

    // 3. Product assigned to a future drop (hidden)
    await prisma.product.create({
      data: {
        title: 'Winter heavyweight Parka',
        slug: 'winter-heavyweight-parka',
        description: 'Extreme cold weather insulated jacket',
        basePrice: 8999.0,
        status: ProductStatus.PUBLISHED,
        categoryId: category.id,
        dropId: futureDrop.id,
      },
    });

    // 4. Product assigned to a released/past drop (visible)
    await prisma.product.create({
      data: {
        title: 'Spring Lightweight Windbreaker',
        slug: 'spring-lightweight-windbreaker',
        description: 'Water-resistant spring streetwear coat',
        basePrice: 4599.0,
        status: ProductStatus.PUBLISHED,
        categoryId: category.id,
        dropId: pastDrop.id,
      },
    });
  });

  describe('GET /catalog/categories', () => {
    it('should return all categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/categories')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].slug).toBe('hoodies');
    });
  });

  describe('GET /catalog/collections', () => {
    it('should return only active collections', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/collections')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].slug).toBe('summer-collection');
    });
  });

  describe('GET /catalog/products', () => {
    it('should return visible products only (excluding drafts and scheduled drops)', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/products')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      // Should find Product 1 (regular published) and Product 4 (past drop).
      // Product 2 (Draft) and Product 3 (Future Drop) must be hidden.
      expect(response.body.data.total).toBe(2);

      const slugs = response.body.data.products.map((p: { slug: string }) => p.slug);
      expect(slugs).toContain('aura-premium-hoodie');
      expect(slugs).toContain('spring-lightweight-windbreaker');
      expect(slugs).not.toContain('draft-sample-tee');
      expect(slugs).not.toContain('winter-heavyweight-parka');
    });

    it('should correctly fetch products filtered by category slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/products?category=hoodies')
        .expect(HttpStatus.OK);

      expect(response.body.data.total).toBe(2);
    });

    it('should filter products by collection slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/products?collection=summer-collection')
        .expect(HttpStatus.OK);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.products[0].slug).toBe('aura-premium-hoodie');
    });
  });

  describe('GET /catalog/products/:slug', () => {
    it('should return product details with its variant media and overrides', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog/products/aura-premium-hoodie')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      const product = response.body.data;
      expect(product.title).toBe('Aura Premium Hoodie');
      expect(product.variants.length).toBe(2);

      // Verify variant media and overrides are mapped
      const blackVariant = product.variants.find((v: { color: string }) => v.color === 'Black');
      expect(blackVariant.stockQuantity).toBe(15);
      expect(blackVariant.mediaUrls).toContain('https://cdn.aura.com/black-front.jpg');
      expect(blackVariant.thumbnailUrl).toBe('https://cdn.aura.com/black-thumb.jpg');

      const redVariant = product.variants.find((v: { color: string }) => v.color === 'Red');
      expect(Number(redVariant.priceOverride)).toBe(3499);
    });

    it('should throw 404 for unreleased scheduled drop product', async () => {
      await request(app.getHttpServer())
        .get('/catalog/products/winter-heavyweight-parka')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /catalog/search', () => {
    it('should perform weighted typo-tolerant search using PostgreSQL trigrams', async () => {
      // Searching "Auraa" instead of "Aura" should match "Aura Premium Hoodie"
      const response = await request(app.getHttpServer())
        .get('/catalog/search?q=Auraa')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.products[0].slug).toBe('aura-premium-hoodie');
    });

    it('should match tags in search queries', async () => {
      // Product 1 contains tag 'heavyweight'
      const response = await request(app.getHttpServer())
        .get('/catalog/search?q=heavyweight')
        .expect(HttpStatus.OK);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.products[0].slug).toBe('aura-premium-hoodie');
    });
  });
});
