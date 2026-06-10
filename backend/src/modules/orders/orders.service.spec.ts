import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../config/prisma.service';
import { CartService } from '../cart/cart.service';
import { ConfigService } from '@nestjs/config';
import { InventoryService } from './inventory.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: any;
  let cartService: any;
  let inventoryService: any;

  beforeEach(async () => {
    prismaService = {
      coupon: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    cartService = {};
    inventoryService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CartService, useValue: cartService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: InventoryService, useValue: inventoryService },
        { provide: getQueueToken('order-expiry'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
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
        value: 10, // 10%
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
        value: 50, // 50%
        maxDiscount: 200, // Max 200
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
        value: 150,
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
        value: 100,
        minOrderValue: 2000,
      });
      await expect(service.applyCoupon('TEST', 1000)).rejects.toThrow(/Order value must be at least/);
    });
  });
});
