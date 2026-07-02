import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../config/prisma.service';

describe('CartService', () => {
  let service: CartService;
  let prismaService: any;
  let redisClient: any;

  beforeEach(async () => {
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };

    prismaService = {
      cart: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prismaService },
        { provide: 'REDIS_CLIENT', useValue: redisClient },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCacheKey', () => {
    it('should throw BadRequestException when neither userId nor sessionId is provided', () => {
      expect(() => (service as any).getCacheKey()).toThrow(BadRequestException);
    });
  });

  describe('getCartItems', () => {
    it('should return cached items on a cache hit', async () => {
      const cached = [
        { id: 'item-1', variantId: 'variant-1', quantity: 2, customData: null },
      ];
      redisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCartItems('user-1');

      expect(result).toEqual(cached);
      expect(redisClient.set).not.toHaveBeenCalled();
      expect(prismaService.cart.findFirst).not.toHaveBeenCalled();
    });

    it('should populate the cache from DB on a cache miss', async () => {
      const dbItems = [
        {
          id: 'item-1',
          productVariantId: 'variant-1',
          quantity: 1,
          customData: null,
        },
      ];
      prismaService.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: dbItems,
      });
      redisClient.get.mockResolvedValue(null);
      redisClient.set.mockResolvedValue('OK');

      const result = await service.getCartItems('user-1');

      expect(result).toEqual([
        { id: 'item-1', variantId: 'variant-1', quantity: 1, customData: null },
      ]);
      expect(redisClient.set).toHaveBeenCalledWith(
        'cart:u:user-1',
        JSON.stringify(result),
        'EX',
        1209600,
      );
    });

    it('should never throw 503 when the cache-population lock is busy', async () => {
      const dbItems = [
        {
          id: 'db-item',
          productVariantId: 'variant-1',
          quantity: 1,
          customData: null,
        },
      ];
      prismaService.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: dbItems,
      });
      redisClient.get.mockResolvedValue(null);
      redisClient.set.mockResolvedValue(null); // lock is always busy

      const calls = Array.from({ length: 5 }, () =>
        service.getCartItems('user-1'),
      );
      const results = await Promise.all(calls);

      for (const result of results) {
        expect(result).toEqual([
          { id: 'db-item', variantId: 'variant-1', quantity: 1, customData: null },
        ]);
      }
    });

    it('should re-read the cache between lock retries and return populated data', async () => {
      const cached = [
        { id: 'cached-item', variantId: 'variant-1', quantity: 5, customData: null },
      ];
      let getCallCount = 0;
      redisClient.get.mockImplementation(() => {
        getCallCount += 1;
        if (getCallCount <= 2) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(cached));
      });
      redisClient.set.mockResolvedValue(null); // lock busy on first attempts

      const result = await service.getCartItems('user-1');

      expect(result).toEqual(cached);
      expect(getCallCount).toBeGreaterThanOrEqual(3);
    });

    it('should return DB cart data when Redis is unavailable', async () => {
      const dbItems = [
        {
          id: 'db-item',
          productVariantId: 'variant-1',
          quantity: 2,
          customData: null,
        },
      ];
      prismaService.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: dbItems,
      });
      redisClient.get.mockRejectedValue(new Error('Redis connection lost'));
      redisClient.set.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.getCartItems('user-1');

      expect(result).toEqual([
        { id: 'db-item', variantId: 'variant-1', quantity: 2, customData: null },
      ]);
    });

    it('should return an empty array when there is no cart in DB or cache', async () => {
      prismaService.cart.findFirst.mockResolvedValue(null);
      redisClient.get.mockResolvedValue(null);
      redisClient.set.mockResolvedValue('OK');

      const result = await service.getCartItems('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('customDataKey', () => {
    it('should return null for missing or invalid customData', () => {
      expect((service as any).customDataKey(null)).toBeNull();
      expect((service as any).customDataKey(undefined)).toBeNull();
      expect((service as any).customDataKey('text')).toBeNull();
      expect((service as any).customDataKey(42)).toBeNull();
      expect((service as any).customDataKey([])).toBeNull();
    });

    it('should produce the same key regardless of key ordering', () => {
      const key1 = (service as any).customDataKey({
        productId: 'p1',
        size: 'M',
        color: 'red',
        designUrl: 'http://example.com/design.png',
      });
      const key2 = (service as any).customDataKey({
        color: 'red',
        designUrl: 'http://example.com/design.png',
        size: 'M',
        productId: 'p1',
      });

      expect(key1).toBe(key2);
    });

    it('should include design-like, printUrl, text, and placement fields', () => {
      const key = (service as any).customDataKey({
        productId: 'p1',
        size: 'L',
        color: 'blue',
        designFront: 'front.png',
        designBack: 'back.png',
        printUrl: 'print.png',
        text: 'Hello',
        placement: 'front',
      });

      expect(key).toContain('productId="p1"');
      expect(key).toContain('size="L"');
      expect(key).toContain('color="blue"');
      expect(key).toContain('designfront="front.png"');
      expect(key).toContain('designback="back.png"');
      expect(key).toContain('printurl="print.png"');
      expect(key).toContain('text="Hello"');
      expect(key).toContain('placement="front"');
    });

    it('should treat case-insensitive design keys consistently', () => {
      const key1 = (service as any).customDataKey({
        productId: 'p1',
        DesignFront: 'front.png',
      });
      const key2 = (service as any).customDataKey({
        productId: 'p1',
        designFront: 'front.png',
      });

      expect(key1).toBe(key2);
    });

    it('should produce different keys for logically different custom data', () => {
      const key1 = (service as any).customDataKey({
        productId: 'p1',
        size: 'M',
        color: 'red',
      });
      const key2 = (service as any).customDataKey({
        productId: 'p1',
        size: 'M',
        color: 'blue',
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('mergeCart', () => {
    const buildTx = () => ({
      cart: prismaService.cart,
      cartItem: prismaService.cartItem,
      productVariant: prismaService.productVariant,
      $executeRaw: prismaService.$executeRaw,
    });

    beforeEach(() => {
      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(buildTx()),
      );
    });

    it('should merge custom items with the same logical customData but different key order', async () => {
      const guestItems = [
        {
          id: 'guest-item',
          productVariantId: null,
          quantity: 2,
          customData: {
            productId: 'p1',
            color: 'red',
            size: 'M',
            designUrl: 'http://example.com/design.png',
          },
        },
      ];
      const userItems = [
        {
          id: 'user-item',
          productVariantId: null,
          quantity: 3,
          customData: {
            size: 'M',
            designUrl: 'http://example.com/design.png',
            productId: 'p1',
            color: 'red',
          },
        },
      ];

      prismaService.cart.findUnique.mockResolvedValue({
        id: 'guest-cart',
        items: guestItems,
      });
      prismaService.cart.findFirst.mockResolvedValue({ id: 'user-cart' });
      prismaService.cartItem.findMany.mockResolvedValue(userItems);
      prismaService.productVariant.findMany.mockResolvedValue([]);
      prismaService.cartItem.update.mockResolvedValue({});
      prismaService.cartItem.deleteMany.mockResolvedValue({});
      prismaService.cart.delete.mockResolvedValue({});

      jest
        .spyOn(service, 'getCart')
        .mockResolvedValue({ items: [], totalAmount: 0 });

      await service.mergeCart('guest-session', 'user-1');

      expect(prismaService.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'user-item' },
        data: { quantity: 5 },
      });
      expect(prismaService.cartItem.create).not.toHaveBeenCalled();
    });

    it('should create a new custom row when customData differs logically', async () => {
      const guestItems = [
        {
          id: 'guest-item',
          productVariantId: null,
          quantity: 2,
          customData: {
            productId: 'p1',
            size: 'M',
            color: 'red',
          },
        },
      ];
      const userItems = [
        {
          id: 'user-item',
          productVariantId: null,
          quantity: 3,
          customData: {
            productId: 'p1',
            size: 'M',
            color: 'blue',
          },
        },
      ];

      prismaService.cart.findUnique.mockResolvedValue({
        id: 'guest-cart',
        items: guestItems,
      });
      prismaService.cart.findFirst.mockResolvedValue({ id: 'user-cart' });
      prismaService.cartItem.findMany.mockResolvedValue(userItems);
      prismaService.productVariant.findMany.mockResolvedValue([]);
      prismaService.cartItem.create.mockResolvedValue({});
      prismaService.cartItem.deleteMany.mockResolvedValue({});
      prismaService.cart.delete.mockResolvedValue({});

      jest
        .spyOn(service, 'getCart')
        .mockResolvedValue({ items: [], totalAmount: 0 });

      await service.mergeCart('guest-session', 'user-1');

      expect(prismaService.cartItem.update).not.toHaveBeenCalled();
      expect(prismaService.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'user-cart',
          quantity: 2,
          customData: guestItems[0].customData,
        },
      });
    });
  });
});
