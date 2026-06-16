import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/config/prisma.service';
import { OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { OrdersService } from '../src/modules/orders/orders.service';
import { AbandonedCartCron } from '../src/modules/orders/abandoned-cart.cron';

describe('OrdersModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;
  let userId: string;

  let hoodieCategoryId: string;
  let productVariantId: string;

  const guestSessionId = '98765432-9876-9876-9876-987654321098';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.webhookEvent.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed mock category, product, variant
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

    // Create user and get JWT
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'orders-test@example.com', password: 'securePassword123!' });
    userId = signupRes.body.data.userId;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'orders-test@example.com', password: 'securePassword123!' });
    jwtToken = loginRes.body.data.accessToken;
  });

  const testAddress = {
    shippingEmail: 'customer@example.com',
    shippingName: 'John Doe',
    shippingPhone: '9876543210',
    shippingStreet: '123 Fashion Ave',
    shippingCity: 'Mumbai',
    shippingState: 'Maharashtra',
    shippingPostalCode: '400001',
    shippingCountry: 'India',
  };

  describe('/orders/checkout (POST)', () => {
    it('should checkout and reserve inventory successfully for authenticated user', async () => {
      // 1. Add item to cart
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 2 })
        .expect(HttpStatus.CREATED);

      // 2. Perform checkout
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress)
        .expect(HttpStatus.CREATED);

      expect(checkoutRes.body.success).toBe(true);
      expect(checkoutRes.body.data.orderId).toBeDefined();
      expect(checkoutRes.body.data.razorpayOrderId).toBeDefined();
      expect(checkoutRes.body.data.currency).toBe('INR');

      // Check expected price: 2 * 2999 = 5998. Tax 18% = 1079.64. Shipping = 100. Total = 7177.64
      expect(checkoutRes.body.data.amount).toBeCloseTo(7177.64, 2);

      // 3. Verify stock is reserved/reduced
      const variant = await prisma.productVariant.findUnique({
        where: { id: productVariantId },
      });
      expect(variant?.stockQuantity).toBe(8); // 10 - 2

      // 4. Verify order is PAYMENT_PENDING in DB
      const order = await prisma.order.findUnique({
        where: { id: checkoutRes.body.data.orderId },
      });
      expect(order?.status).toBe(OrderStatus.PAYMENT_PENDING);
    });

    it('should prevent overselling and handle concurrency errors', async () => {
      // 1. User 1 adds 9 items (stock is 10)
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 9 })
        .expect(HttpStatus.CREATED);

      // User 1 checkouts
      await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress)
        .expect(HttpStatus.CREATED);

      // Stock is now 1
      const variant = await prisma.productVariant.findUnique({
        where: { id: productVariantId },
      });
      expect(variant?.stockQuantity).toBe(1);

      // 2. Guest adds 2 items to cart (using guest sessionId)
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('x-cart-session-id', guestSessionId)
        .send({ variantId: productVariantId, quantity: 2 })
        .expect(HttpStatus.CREATED);

      // Guest checkouts -> should fail because stock is 1
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .send({ ...testAddress, guestSessionId })
        .expect(HttpStatus.BAD_REQUEST);

      expect(checkoutRes.body.success).toBe(false);
      expect(checkoutRes.body.message[0]).toContain('exceed available stock');
    });
  });

  describe('/orders/verify-payment (POST)', () => {
    it('should transition order to PAID upon valid payment signature verification', async () => {
      // 1. Checkout to create order
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress);

      const orderId = checkoutRes.body.data.orderId;
      const razorpayOrderId = checkoutRes.body.data.razorpayOrderId;
      const razorpayPaymentId = 'pay_mock123456';

      // 2. Generate expected signature
      const keySecret = 'mock_razorpay_secret';
      const razorpaySignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      // 3. Verify payment
      const verifyRes = await request(app.getHttpServer())
        .post('/orders/verify-payment')
        .send({ razorpayOrderId, razorpayPaymentId, razorpaySignature })
        .expect(HttpStatus.CREATED);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe(OrderStatus.PAID);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { statusHistory: true },
      });
      expect(order?.status).toBe(OrderStatus.PAID);
      expect(order?.razorpayPaymentId).toBe(razorpayPaymentId);
      expect(order?.paymentStatus).toBe('PAID');

      // Ensure history audit is recorded
      expect(order?.statusHistory.some((h) => h.newStatus === OrderStatus.PAID)).toBe(true);
    });
  });

  describe('/orders/webhook (POST)', () => {
    it('should idempotently transition status to PAID and skip duplicate calls', async () => {
      // 1. Checkout to create order
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress);

      const razorpayOrderId = checkoutRes.body.data.razorpayOrderId;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret_dev';
      const eventId = 'evt_test123';

      const webhookBodyObj = {
        id: eventId,
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: razorpayOrderId,
            },
          },
          payment: {
            entity: {
              id: 'pay_webhook123',
              order_id: razorpayOrderId,
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookBodyObj);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      // First webhook call (Should Process)
      const firstWebhookRes = await request(app.getHttpServer())
        .post('/orders/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      if (firstWebhookRes.status === 400) {
        console.error('WEBHOOK ERROR:', firstWebhookRes.body);
      }

      expect(firstWebhookRes.status).toBe(HttpStatus.CREATED);

      expect(firstWebhookRes.body.data.status).toBe('processed');

      // Verify PAID state in DB
      const order = await prisma.order.findUnique({
        where: { id: checkoutRes.body.data.orderId },
      });
      expect(order?.status).toBe(OrderStatus.PAID);

      // Second webhook call (Should Skip Idempotently)
      const secondWebhookRes = await request(app.getHttpServer())
        .post('/orders/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody)
        .expect(HttpStatus.CREATED);

      expect(secondWebhookRes.body.data.status).toBe('ignored');
    });
  });

  describe('Inventory Restoration on Expiry / Cancel', () => {
    it('should restore stock quantities when order is cancelled or failed', async () => {
      // 1. Checkout to create order
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 3 })
        .expect(HttpStatus.CREATED);

      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress);

      const orderId = checkoutRes.body.data.orderId;

      // Verify stock is reduced
      let variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
      expect(variant?.stockQuantity).toBe(7); // 10 - 3

      // 2. Perform direct state machine cancellation (which handles stock restoration)
      const ordersService = app.get(OrdersService);
      await ordersService.transitionStatus(
        orderId,
        OrderStatus.CANCELLED,
        'ADMIN',
        'Customer requested cancellation.',
      );

      // 3. Verify stock is restored
      variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
      expect(variant?.stockQuantity).toBe(10); // restored back to 10!

      // Verify DB status is CANCELLED
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('AbandonedCartCron E2E', () => {
    it('should sweep expired PAYMENT_PENDING orders and restore stock', async () => {
      const cronService = app.get(AbandonedCartCron);

      // 1. Add item to cart
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 2 })
        .expect(HttpStatus.CREATED);

      // 2. Checkout
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress);

      const orderId = checkoutRes.body.data.orderId;

      // Assert stock is reduced
      let variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
      expect(variant?.stockQuantity).toBe(8);

      // 3. Artificially backdate the order's createdAt to 20 minutes ago
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: twentyMinutesAgo },
      });

      // 4. Run sweeper
      await cronService.handleAbandonedCarts();

      // 5. Verify status is FAILED and stock is restored
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe(OrderStatus.FAILED);

      variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
      expect(variant?.stockQuantity).toBe(10);
    });
  });

  describe('Webhook Concurrency Race E2E', () => {
    it('should handle parallel duplicate webhook requests gracefully without P2002 500 error', async () => {
      // 1. Checkout to create order
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(testAddress);

      const razorpayOrderId = checkoutRes.body.data.razorpayOrderId;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret_dev';
      const eventId = `evt_race_${crypto.randomUUID()}`;

      const webhookBodyObj = {
        id: eventId,
        event: 'order.paid',
        payload: {
          order: { entity: { id: razorpayOrderId } },
          payment: { entity: { id: 'pay_race123', order_id: razorpayOrderId } },
        },
      };

      const rawBody = JSON.stringify(webhookBodyObj);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      // Send 2 webhook requests simultaneously using Promise.all
      const requests = [
        request(app.getHttpServer())
          .post('/orders/webhook')
          .set('x-razorpay-signature', signature)
          .set('Content-Type', 'application/json')
          .send(rawBody),
        request(app.getHttpServer())
          .post('/orders/webhook')
          .set('x-razorpay-signature', signature)
          .set('Content-Type', 'application/json')
          .send(rawBody),
      ];

      const responses = await Promise.all(requests);

      // Verify that both completed successfully (no 500 internal server error)
      const statuses = responses.map((r) => r.status);
      expect(statuses).toContain(201); // Standard created status

      const bodyStatuses = responses.map((r) => r.body.data.status);
      expect(bodyStatuses).toContain('processed');
      expect(bodyStatuses).toContain('ignored'); // One of them must be ignored duplicate
    });
  });

  describe('Deadlock Prevention Concurrency E2E', () => {
    it('should handle concurrent checkouts of overlapping items without deadlock exceptions', async () => {
      // Seed a second variant
      const product = await prisma.product.findFirst({
        where: { slug: 'aura-premium-hoodie' },
      });
      const secondVariant = await prisma.productVariant.create({
        data: {
          productId: product!.id,
          sku: 'AURA-HD-BLK-L',
          size: 'L',
          color: 'Black',
          stockQuantity: 10,
        },
      });

      // We will perform two concurrent checkouts.
      // Cart 1: variant A, then variant B
      // Cart 2: variant B, then variant A
      // Since variant locking orders are sorted, they will not deadlock.

      // Setup Cart 1 (User 1 - authenticated)
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ variantId: secondVariant.id, quantity: 1 })
        .expect(HttpStatus.CREATED);

      // Setup Cart 2 (Guest - guestSessionId)
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('x-cart-session-id', guestSessionId)
        .send({ variantId: secondVariant.id, quantity: 1 })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('x-cart-session-id', guestSessionId)
        .send({ variantId: productVariantId, quantity: 1 })
        .expect(HttpStatus.CREATED);

      // Run checkouts in parallel
      const checkouts = [
        request(app.getHttpServer())
          .post('/orders/checkout')
          .set('Authorization', `Bearer ${jwtToken}`)
          .send(testAddress),
        request(app.getHttpServer())
          .post('/orders/checkout')
          .send({ ...testAddress, guestSessionId }),
      ];

      const results = await Promise.all(checkouts);

      // Both should succeed (or at least none should fail with a 500 deadlock / database lock abort error)
      for (const res of results) {
        expect(res.status).toBe(HttpStatus.CREATED);
        expect(res.body.success).toBe(true);
      }
    });
  });
});
