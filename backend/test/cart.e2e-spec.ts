import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';

describe('CartModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;
  let userId: string;

  let hoodieCategoryId: string;
  let productVariantId: string;
  let otherVariantId: string;

  const guestSessionId = '12345678-1234-1234-1234-123456789012';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    // Clear dependencies in order
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed basic Catalog details for testing
    const category = await prisma.category.create({
      data: { name: 'Hoodies', slug: 'hoodies' },
    });
    hoodieCategoryId = category.id;

    const product = await prisma.product.create({
      data: {
        title: 'Aura Premium Hoodie',
        slug: 'aura-premium-hoodie',
        description: 'Gen-Z oversized fit hoodie',
        basePrice: 2999.0,
        status: 'PUBLISHED',
        categoryId: category.id,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'AURA-HD-BLK-M',
        size: 'M',
        color: 'Black',
        stockQuantity: 10,
      },
    });
    productVariantId = variant.id;

    const otherVariant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'AURA-HD-RED-L',
        size: 'L',
        color: 'Red',
        stockQuantity: 5,
        priceOverride: 3499.0,
      },
    });
    otherVariantId = otherVariant.id;

    // Create a mock user and sign in to get JWT token
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'cart-test@example.com', password: 'securePassword123!' });
    userId = signupRes.body.data.userId;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cart-test@example.com', password: 'securePassword123!' });
    jwtToken = loginRes.body.data.accessToken;
  });

  describe('Guest Cart Operations', () => {
    it('should fail cart access without session or auth header', async () => {
      const response = await request(app.getHttpServer())
        .get('/cart')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.message[0]).toContain('Session identifier');
    });

    it('should retrieve an empty cart for guest', async () => {
      const response = await request(app.getHttpServer())
        .get('/cart')
        .set('x-cart-session-id', guestSessionId)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(0);
      expect(response.body.data.totalAmount).toBe(0);
    });

    it('should add, update, and remove items in guest cart', async () => {
      // 1. Add item
      const addRes = await request(app.getHttpServer())
        .post('/cart/items')
        .set('x-cart-session-id', guestSessionId)
        .send({ variantId: productVariantId, quantity: 2 })
        .expect(HttpStatus.CREATED);

      expect(addRes.body.success).toBe(true);
      expect(addRes.body.data.items.length).toBe(1);
      expect(addRes.body.data.items[0].sku).toBe('AURA-HD-BLK-M');
      expect(addRes.body.data.items[0].quantity).toBe(2);
      expect(addRes.body.data.totalAmount).toBe(2 * 2999.0);

      // 2. Update item quantity
      const updateRes = await request(app.getHttpServer())
        .patch(`/cart/items/${productVariantId}`)
        .set('x-cart-session-id', guestSessionId)
        .send({ quantity: 5 })
        .expect(HttpStatus.OK);

      expect(updateRes.body.data.items[0].quantity).toBe(5);
      expect(updateRes.body.data.totalAmount).toBe(5 * 2999.0);

      // 3. Reject updates exceeding stock
      await request(app.getHttpServer())
        .patch(`/cart/items/${productVariantId}`)
        .set('x-cart-session-id', guestSessionId)
        .send({ quantity: 15 })
        .expect(HttpStatus.BAD_REQUEST);

      // 4. Remove item
      const removeRes = await request(app.getHttpServer())
        .delete(`/cart/items/${productVariantId}`)
        .set('x-cart-session-id', guestSessionId)
        .expect(HttpStatus.OK);

      expect(removeRes.body.data.items.length).toBe(0);
    });
  });

  describe('Authenticated Cart Operations', () => {
    it('should manage cart for authenticated user', async () => {
      // 1. Add item with price override check
      const addRes = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: otherVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      expect(addRes.body.success).toBe(true);
      expect(addRes.body.data.items[0].sku).toBe('AURA-HD-RED-L');
      expect(addRes.body.data.items[0].unitPrice).toBe(3499.0);
      expect(addRes.body.data.totalAmount).toBe(3499.0);
    });
  });

  describe('Cart Merging', () => {
    it('should merge guest cart into user cart on login/merge request', async () => {
      // Add variant 1 to guest cart
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('x-cart-session-id', guestSessionId)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      // Add variant 2 to user cart
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: otherVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      // Merge
      const mergeRes = await request(app.getHttpServer())
        .post('/cart/merge')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ guestSessionId })
        .expect(HttpStatus.CREATED);

      expect(mergeRes.body.success).toBe(true);
      expect(mergeRes.body.data.items.length).toBe(2);

      const skus = mergeRes.body.data.items.map((i: { sku: string }) => i.sku);
      expect(skus).toContain('AURA-HD-BLK-M');
      expect(skus).toContain('AURA-HD-RED-L');

      // Verify guest cart is cleared
      const guestCartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('x-cart-session-id', guestSessionId)
        .expect(HttpStatus.OK);
      expect(guestCartRes.body.data.items.length).toBe(0);
    });
  });
});
