import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../config/prisma.service';
import { CartService } from '../cart/cart.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { getQueueToken } from '@nestjs/bullmq';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

describe('OrdersService', () => {
  let service: OrdersService;
  let testingModule: TestingModule;
  let prismaService: any;
  let cartService: any;
  let inventoryService: any;
  let configService: any;
  let redisClient: any;

  beforeEach(async () => {
    prismaService = {
      coupon: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    cartService = {};
    inventoryService = {};
    configService = { get: jest.fn() };

    testingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CartService, useValue: cartService },
        { provide: ConfigService, useValue: configService },
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
          },
        },
        { provide: getQueueToken('order-expiry'), useValue: { add: jest.fn() } },
        { provide: AuditService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = testingModule.get<OrdersService>(OrdersService);
    redisClient = testingModule.get('REDIS_CLIENT');
  });

  describe('applyCoupon', () => {
    it('should throw NotFoundException if coupon does not exist', async () => {
      prismaService.coupon.findUnique.mockResolvedValue(null);
      await expect(service.applyCoupon('INVALID', 1000)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if coupon is inactive', async () => {
      prismaService.coupon.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.applyCoupon('INACTIVE', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should calculate PERCENTAGE discount correctly', async () => {
      prismaService.coupon.findUnique.mockResolvedValue({
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        type: 'PERCENTAGE',
        value: new Prisma.Decimal(10), // 10%
        code: 'TENOFF',
      });
      const result = await service.applyCoupon('TENOFF', 1000);
      expect(result.discount).toBe(100);
      expect(result.code).toBe('TENOFF');
    });

    it('should apply maxDiscount correctly for PERCENTAGE type', async () => {
      prismaService.coupon.findUnique.mockResolvedValue({
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        type: 'PERCENTAGE',
        value: new Prisma.Decimal(50), // 50%
        maxDiscount: new Prisma.Decimal(200), // Max 200
        code: 'HALFOFF',
      });
      const result = await service.applyCoupon('HALFOFF', 1000);
      expect(result.discount).toBe(200); // 500 limited to 200
    });

    it('should calculate FIXED discount correctly', async () => {
      prismaService.coupon.findUnique.mockResolvedValue({
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        type: 'FIXED',
        value: new Prisma.Decimal(150),
        code: 'MINUS150',
      });
      const result = await service.applyCoupon('MINUS150', 1000);
      expect(result.discount).toBe(150);
    });

    it('should throw BadRequestException if subtotal < minOrderValue', async () => {
      prismaService.coupon.findUnique.mockResolvedValue({
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        type: 'FIXED',
        value: new Prisma.Decimal(100),
        minOrderValue: new Prisma.Decimal(2000),
      });
      await expect(service.applyCoupon('TEST', 1000)).rejects.toThrow(
        /Order value must be at least/,
      );
    });
  });

  describe('checkout coupon concurrency', () => {
    it('should not allow concurrent checkouts to exceed coupon usage limit', async () => {
      const couponCode = 'LIMITED2';
      const usageLimit = 2;
      let usageCount = 0;

      cartService.getCart = jest.fn().mockResolvedValue({
        items: [
          {
            variantId: 'variant-1',
            quantity: 1,
            sku: 'SKU1',
            unitPrice: 1000,
            isAvailable: true,
            customData: null,
          },
        ],
        totalAmount: 1000,
      });
      cartService.clearCart = jest.fn().mockResolvedValue(undefined);

      prismaService.idempotencyKey = {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      };

      prismaService.order = {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'order-id' }),
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.orderStatusHistory = {
        createMany: jest.fn().mockResolvedValue({}),
      };

      inventoryService.restoreBulkInventory = jest.fn().mockResolvedValue(undefined);
      inventoryService.reserveInventory = jest.fn().mockResolvedValue(undefined);

      // Serialize transaction callbacks to simulate SELECT FOR UPDATE row locking.
      let transactionChain: Promise<any> = Promise.resolve();
      prismaService.$transaction = jest.fn().mockImplementation(async (callback: any) => {
        const run = async () => {
          const tx = {
            order: prismaService.order,
            orderStatusHistory: prismaService.orderStatusHistory,
            coupon: {
              update: jest.fn().mockImplementation(async () => {
                if (usageCount >= usageLimit) {
                  throw new BadRequestException('This coupon has reached its usage limit');
                }
                usageCount += 1;
                return { code: couponCode, usageCount };
              }),
            },
            $queryRaw: jest.fn().mockImplementation(async () => [
              {
                code: couponCode,
                is_active: true,
                valid_from: new Date(Date.now() - 10000),
                valid_until: null,
                usage_limit: usageLimit,
                usage_count: usageCount,
                min_order_value: null,
                type: 'FIXED',
                value: 100,
                max_discount: null,
              },
            ]),
          };
          return callback(tx);
        };
        transactionChain = transactionChain.then(run, run);
        return transactionChain;
      });

      const dto: any = {
        paymentMethod: 'cod',
        couponCode,
        shippingName: 'Test',
        shippingEmail: 'test@example.com',
        shippingPhone: '1234567890',
        shippingStreet: 'Street',
        shippingCity: 'City',
        shippingState: 'State',
        shippingPostalCode: '123456',
        shippingCountry: 'IN',
      };

      const results = await Promise.allSettled([
        service.checkout(dto),
        service.checkout(dto),
        service.checkout(dto),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.filter((r) => r.status === 'rejected').length;

      expect(successes).toBe(2);
      expect(failures).toBe(1);
      expect(
        results.some(
          (r) =>
            r.status === 'rejected' &&
            r.reason.message &&
            r.reason.message.toLowerCase().includes('usage limit'),
        ),
      ).toBe(true);
      expect(usageCount).toBe(2);
    });
  });

  describe('idempotency key handling', () => {
    const baseCheckoutDto: any = {
      paymentMethod: 'cod',
      shippingName: 'Test',
      shippingEmail: 'test@example.com',
      shippingPhone: '1234567890',
      shippingStreet: 'Street',
      shippingCity: 'City',
      shippingState: 'State',
      shippingPostalCode: '123456',
      shippingCountry: 'IN',
      guestSessionId: 'guest-1',
    };

    beforeEach(() => {
      cartService.getCart = jest.fn().mockResolvedValue({
        items: [
          {
            variantId: 'variant-1',
            quantity: 1,
            sku: 'SKU1',
            unitPrice: 1000,
            isAvailable: true,
            customData: null,
          },
        ],
        totalAmount: 1000,
      });
      cartService.clearCart = jest.fn().mockResolvedValue(undefined);

      inventoryService.reserveInventory = jest.fn().mockResolvedValue(undefined);
      inventoryService.restoreBulkInventory = jest.fn().mockResolvedValue(undefined);

      prismaService.idempotencyKey = {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      };

      prismaService.order = {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'order-id' }),
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.orderStatusHistory = {
        createMany: jest.fn().mockResolvedValue({}),
      };

      prismaService.coupon = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      };

      prismaService.$executeRaw = jest.fn().mockResolvedValue(undefined);
      prismaService.$queryRaw = jest.fn().mockResolvedValue([]);

      prismaService.$transaction = jest
        .fn()
        .mockImplementation(async (callback: any, _opts?: any) => {
          const tx = {
            idempotencyKey: prismaService.idempotencyKey,
            order: prismaService.order,
            orderStatusHistory: prismaService.orderStatusHistory,
            coupon: prismaService.coupon,
            $executeRaw: prismaService.$executeRaw,
            $queryRaw: prismaService.$queryRaw,
          };
          return callback(tx);
        });
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedResponse = {
        orderId: 'order-id',
        razorpayOrderId: 'rzp_test_cached',
        amount: 1000,
        currency: 'INR',
        guestToken: 'guest-1',
      };

      prismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: 'key-1',
        response: cachedResponse,
        createdAt: new Date(Date.now() - 60000),
      });

      const result = await service.checkout(
        { ...baseCheckoutDto, idempotencyKey: 'key-1' },
        undefined,
      );

      expect(result).toEqual(cachedResponse);
      expect(prismaService.idempotencyKey.create).not.toHaveBeenCalled();
      expect(prismaService.idempotencyKey.delete).not.toHaveBeenCalled();
      expect(cartService.getCart).not.toHaveBeenCalled();
    });

    it('should throw conflict for in-progress idempotency key', async () => {
      prismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: 'key-2',
        response: null,
        createdAt: new Date(Date.now() - 5000),
      });

      await expect(
        service.checkout({ ...baseCheckoutDto, idempotencyKey: 'key-2' }, undefined),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.checkout({ ...baseCheckoutDto, idempotencyKey: 'key-2' }, undefined),
      ).rejects.toThrow(/already in progress/);

      expect(prismaService.idempotencyKey.create).not.toHaveBeenCalled();
    });

    it('should replace a zombie idempotency key and allow checkout', async () => {
      prismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: 'key-3',
        response: null,
        createdAt: new Date(Date.now() - 35000),
      });

      const result = await service.checkout(
        { ...baseCheckoutDto, idempotencyKey: 'key-3' },
        undefined,
      );

      expect(prismaService.idempotencyKey.delete).toHaveBeenCalledWith({
        where: { key: 'key-3' },
      });
      expect(prismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          key: 'key-3',
          expiresAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        orderId: 'order-id',
        razorpayOrderId: '',
        amount: 1000,
        currency: 'INR',
        guestToken: 'guest-1',
      });
    });
  });

  describe('Razorpay circuit breaker', () => {
    const baseCheckoutDto: any = {
      paymentMethod: 'razorpay',
      shippingName: 'Test',
      shippingEmail: 'test@example.com',
      shippingPhone: '1234567890',
      shippingStreet: 'Street',
      shippingCity: 'City',
      shippingState: 'State',
      shippingPostalCode: '123456',
      shippingCountry: 'IN',
    };

    const mockFetchResponse = (status: number, body: any = {}) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
        json: jest.fn().mockResolvedValue(body),
      }) as unknown as Response;

    beforeEach(() => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_abcdef12345678';
        if (key === 'RAZORPAY_KEY_SECRET') return 'secret12345678';
        return undefined;
      });

      cartService.getCart = jest.fn().mockResolvedValue({
        items: [
          {
            variantId: 'variant-1',
            quantity: 1,
            sku: 'SKU1',
            unitPrice: 1000,
            isAvailable: true,
            customData: null,
          },
        ],
        totalAmount: 1000,
      });

      inventoryService.reserveInventory = jest.fn().mockResolvedValue(undefined);
      inventoryService.restoreInventory = jest.fn().mockResolvedValue(undefined);
      inventoryService.restoreBulkInventory = jest.fn().mockResolvedValue(undefined);

      let orderSeq = 0;
      prismaService.idempotencyKey = {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      };

      prismaService.order = {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation(() => {
          orderSeq += 1;
          return { id: `order-id-${orderSeq}` };
        }),
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.orderStatusHistory = {
        createMany: jest.fn().mockResolvedValue({}),
      };

      prismaService.productVariant = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      };

      prismaService.cartItem = {
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.coupon = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      };

      prismaService.$queryRaw = jest.fn().mockResolvedValue([]);
      prismaService.$queryRawUnsafe = jest.fn().mockResolvedValue([
        {
          id: 'order-id-1',
          status: 'PAYMENT_PENDING',
          coupon_code: null,
        },
      ]);

      prismaService.$transaction = jest.fn().mockImplementation(async (callback: any) => {
        const tx = {
          order: prismaService.order,
          orderStatusHistory: prismaService.orderStatusHistory,
          coupon: prismaService.coupon,
          productVariant: prismaService.productVariant,
          cartItem: prismaService.cartItem,
          $queryRaw: prismaService.$queryRaw,
          $queryRawUnsafe: prismaService.$queryRawUnsafe,
        };
        return callback(tx);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should open circuit after 5 consecutive 5xx errors', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockFetchResponse(500, { error: 'Internal Server Error' }));

      // Each checkout performs up to 3 fetch attempts, so two checkouts are enough
      // to accumulate the 5 countable failures required to open the circuit.
      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow(
        'Payment gateway is temporarily unavailable',
      );
      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow(
        'Payment gateway is temporarily unavailable',
      );

      // The next checkout should see the open circuit and not invoke fetch.
      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow('Circuit breaker open');

      expect(fetchSpy).toHaveBeenCalledTimes(6);
    }, 20000);

    it('should not open circuit for 4xx errors', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockFetchResponse(400, { error: 'Bad Request' }));

      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow('Razorpay API error');
      expect((service as any).razorpayFailures).toBe(0);
      expect((service as any).razorpayCircuitOpenUntil).toBe(0);

      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow('Razorpay API error');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('payment verification concurrency', () => {
    const razorpayOrderId = 'order_rzp_1';
    const razorpayPaymentId = 'pay_1';
    const keySecret = 'razorpay-secret';
    const webhookSecret = 'webhook-secret';

    const makeVerifySignature = () =>
      crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    const makeWebhookSignature = (payload: any) =>
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const makePendingOrder = (overrides: any = {}) => ({
      id: 'ord-1',
      razorpayOrderId,
      status: 'PAYMENT_PENDING',
      userId: 'user-1',
      guestToken: null,
      razorpayPaymentId: null,
      ...overrides,
    });

    beforeEach(() => {
      redisClient.set = jest.fn();
      redisClient.get = jest.fn();
      redisClient.del = jest.fn();

      cartService.clearCart = jest.fn().mockResolvedValue(undefined);

      configService.get.mockImplementation((key: string) => {
        if (key === 'RAZORPAY_KEY_SECRET') return keySecret;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return webhookSecret;
        return undefined;
      });

      prismaService.order = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.webhookEvent = {
        create: jest.fn().mockResolvedValue({}),
      };

      prismaService.$transaction = jest.fn().mockImplementation(async (callback: any) => {
        const tx = {
          order: prismaService.order,
          webhookEvent: prismaService.webhookEvent,
        };
        return callback(tx);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should only transition once when verifyPayment and handleWebhook race', async () => {
      jest
        .spyOn(service as any, 'generateLockToken')
        .mockReturnValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.del.mockResolvedValue(1);

      prismaService.order.findUnique.mockResolvedValue(makePendingOrder());

      const transitionSpy = jest.spyOn(service, 'transitionStatus').mockResolvedValue({} as any);

      const payload = {
        id: 'evt-1',
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
              id: razorpayPaymentId,
            },
          },
        },
      };

      const [verifyResult, webhookResult] = await Promise.allSettled([
        service.verifyPayment(
          {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: makeVerifySignature(),
          },
          'user-1',
        ),
        service.handleWebhook(JSON.stringify(payload), makeWebhookSignature(payload)),
      ]);

      expect(verifyResult.status).toBe('fulfilled');
      expect((verifyResult as any).value).toEqual({
        success: true,
        orderId: 'ord-1',
        status: 'PAID',
      });

      expect(webhookResult.status).toBe('rejected');
      expect((webhookResult as any).reason).toBeInstanceOf(ConflictException);
      expect((webhookResult as any).reason.message).toBe(
        'Payment verification already in progress.',
      );

      expect(transitionSpy).toHaveBeenCalledTimes(1);
      expect(transitionSpy).toHaveBeenCalledWith(
        'ord-1',
        'PAID',
        'USER',
        'Payment signature verified.',
        expect.anything(),
      );

      expect(cartService.clearCart).toHaveBeenCalledTimes(1);
      expect(cartService.clearCart).toHaveBeenCalledWith('user-1', undefined);
      expect(redisClient.del).toHaveBeenCalledWith(`payment:verify:${razorpayOrderId}`);
    });

    it('should return idempotently from verifyPayment when order is already PAID', async () => {
      jest
        .spyOn(service as any, 'generateLockToken')
        .mockReturnValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.set.mockResolvedValue('OK');
      redisClient.get.mockResolvedValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.del.mockResolvedValue(1);

      prismaService.order.findUnique.mockResolvedValue(
        makePendingOrder({
          status: 'PAID',
          razorpayPaymentId,
        }),
      );

      const transitionSpy = jest.spyOn(service, 'transitionStatus');

      const result = await service.verifyPayment(
        {
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: makeVerifySignature(),
        },
        'user-1',
      );

      expect(result).toEqual({
        success: true,
        orderId: 'ord-1',
        status: 'PAID',
      });
      expect(transitionSpy).not.toHaveBeenCalled();
      expect(cartService.clearCart).not.toHaveBeenCalled();
    });

    it('should return skipped from handleWebhook when order is already PAID', async () => {
      jest
        .spyOn(service as any, 'generateLockToken')
        .mockReturnValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.set.mockResolvedValue('OK');
      redisClient.get.mockResolvedValue('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      redisClient.del.mockResolvedValue(1);

      prismaService.order.findUnique.mockResolvedValue(
        makePendingOrder({
          status: 'PAID',
          razorpayPaymentId,
        }),
      );

      const transitionSpy = jest.spyOn(service, 'transitionStatus');

      const payload = {
        id: 'evt-2',
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
              id: razorpayPaymentId,
            },
          },
        },
      };

      const result = await service.handleWebhook(
        JSON.stringify(payload),
        makeWebhookSignature(payload),
      );

      expect(result).toEqual({ status: WebhookEventStatus.SKIPPED });
      expect(transitionSpy).not.toHaveBeenCalled();
      expect(cartService.clearCart).not.toHaveBeenCalled();
      expect(prismaService.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          id: 'evt-2',
          status: WebhookEventStatus.SKIPPED,
          payload,
        },
      });
    });
  });
});
