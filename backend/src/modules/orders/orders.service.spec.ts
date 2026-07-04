import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../config/prisma.service';
import { CartService } from '../cart/cart.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { Prisma, WebhookEventStatus, OrderStatus } from '@prisma/client';
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
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../../config/settings.service';
import { RestockNotificationsService } from '../restock-notifications/restock-notifications.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let testingModule: TestingModule;
  let prismaService: any;
  let cartService: any;
  let inventoryService: any;
  let configService: any;
  let redisClient: any;

  let paymentsService: any;
  let emailService: any;
  let settingsService: any;
  let restockNotificationsService: any;

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

    emailService = {
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };

    settingsService = {
      getAll: jest.fn().mockResolvedValue({
        tax: { gstPercent: 18, hsnCode: '6109' },
        shipping: { freeThreshold: 0, flatRate: 0 },
        studio: { customPrintMarkup: 250 },
        refunds: { autoApproveWindowDays: 7 },
      }),
    };

    restockNotificationsService = {};

    testingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PaymentsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CartService, useValue: cartService },
        { provide: ConfigService, useValue: configService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: EmailService, useValue: emailService },
        { provide: SettingsService, useValue: settingsService },
        { provide: RestockNotificationsService, useValue: restockNotificationsService },
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
            eval: jest.fn(),
          },
        },
        { provide: getQueueToken('order-expiry'), useValue: { add: jest.fn() } },
        { provide: AuditService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = testingModule.get<OrdersService>(OrdersService);
    paymentsService = testingModule.get<PaymentsService>(PaymentsService);
    redisClient = testingModule.get('REDIS_CLIENT');

    // Default spies on PaymentsService
    jest.spyOn(paymentsService, 'createGatewayOrder').mockResolvedValue({ razorpayOrderId: '' });
    jest.spyOn(paymentsService, 'verifyPaymentSignature').mockImplementation((() => {}) as any);
    jest.spyOn(paymentsService, 'withPaymentLock').mockImplementation((async (key: string, cb: any) => cb()) as any);
    jest.spyOn(paymentsService, 'markOrderPaid').mockResolvedValue({
      orderId: 'ord-1',
      status: OrderStatus.PAID,
      cartToClear: { userId: 'user-1', guestToken: null },
    } as any);
    jest.spyOn(paymentsService, 'refundPayment').mockResolvedValue(undefined);
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
      // Restore createGatewayOrder mock so it runs the real implementation using fetch
      const createOrderSpy = jest.spyOn(paymentsService, 'createGatewayOrder');
      if (createOrderSpy.mockRestore) {
        createOrderSpy.mockRestore();
      }

      (paymentsService as any).razorpayFailures = 0;
      (paymentsService as any).razorpayCircuitOpenUntil = 0;

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

      prismaService.$queryRaw = jest.fn().mockResolvedValue([
        {
          id: 'order-id-1',
          status: 'PAYMENT_PENDING',
          user_id: 'user-1',
          guest_token: null,
          coupon_code: null,
        },
      ]);
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
      expect((paymentsService as any).razorpayFailures).toBe(0);
      expect((paymentsService as any).razorpayCircuitOpenUntil).toBe(0);

      await expect(service.checkout(baseCheckoutDto)).rejects.toThrow('Razorpay API error');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('payment verification concurrency', () => {
    const razorpayOrderId = 'order_rzp_1';
    const razorpayPaymentId = 'pay_1';
    const keySecret = 'razorpay-secret';

    const makeVerifySignature = () =>
      crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

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
      cartService.clearCart = jest.fn().mockResolvedValue(undefined);

      prismaService.order = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      };

      prismaService.$transaction = jest.fn().mockImplementation(async (callback: any) => {
        const tx = {
          order: prismaService.order,
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'ord-1',
              status: 'PAYMENT_PENDING',
              user_id: 'user-1',
              guest_token: null,
              coupon_code: null,
            },
          ]),
        };
        return callback(tx);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should transition to PAID and clear cart when order is PAYMENT_PENDING', async () => {
      prismaService.order.findUnique.mockResolvedValue(makePendingOrder());
      (paymentsService.markOrderPaid as jest.Mock).mockResolvedValue({
        orderId: 'ord-1',
        status: OrderStatus.PAID,
        cartToClear: { userId: 'user-1', guestToken: null },
      });

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

      expect(paymentsService.markOrderPaid).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'ord-1' }),
        razorpayPaymentId,
        'USER',
        'Payment signature verified.',
        expect.any(String),
      );
      expect(cartService.clearCart).toHaveBeenCalledWith('user-1', null);
    });

    it('should return idempotently from verifyPayment when order is already PAID', async () => {
      prismaService.order.findUnique.mockResolvedValue(
        makePendingOrder({
          status: 'PAID',
          razorpayPaymentId,
        }),
      );

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
      expect(paymentsService.markOrderPaid).not.toHaveBeenCalled();
      expect(cartService.clearCart).not.toHaveBeenCalled();
    });

    it('should propagate ConflictException when lock is busy', async () => {
      paymentsService.withPaymentLock.mockRejectedValueOnce(
        new ConflictException('Payment verification already in progress.'),
      );

      await expect(
        service.verifyPayment(
          {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: makeVerifySignature(),
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
