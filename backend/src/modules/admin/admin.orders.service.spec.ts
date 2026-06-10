import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersService } from './admin.orders.service';
import { PrismaService } from '../../config/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;
  let prismaService: any;
  let ordersService: any;

  beforeEach(async () => {
    prismaService = {
      order: {
        findUnique: jest.fn(),
      },
    };

    ordersService = {
      transitionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrdersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    service = module.get<AdminOrdersService>(AdminOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateBulkOrderStatus', () => {
    it('should throw BadRequestException if orderIds array is empty', async () => {
      await expect(service.updateBulkOrderStatus([], OrderStatus.SHIPPED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should correctly report success and failures in bulk update', async () => {
      // Mock findUnique to fail for 'id-2' and succeed for others
      prismaService.order.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'id-2') {
          return Promise.resolve(null); // Not found
        }
        return Promise.resolve({ id: where.id, status: OrderStatus.PAID });
      });

      // Mock transitionStatus to succeed
      ordersService.transitionStatus.mockResolvedValue(true);

      const result = await service.updateBulkOrderStatus(
        ['id-1', 'id-2', 'id-3'],
        OrderStatus.SHIPPED,
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].id).toBe('id-2');
      expect(result.errors[0].message).toBe('Order not found');

      expect(ordersService.transitionStatus).toHaveBeenCalledTimes(2);
      expect(ordersService.transitionStatus).toHaveBeenCalledWith(
        'id-1',
        OrderStatus.SHIPPED,
        'ADMIN',
        'Status updated manually by admin'
      );
    });
  });

  describe('processRefund', () => {
    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);
      await expect(service.processRefund('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is not paid', async () => {
      prismaService.order.findUnique.mockResolvedValue({ id: 'id-1', status: OrderStatus.PENDING });
      await expect(service.processRefund('id-1')).rejects.toThrow(BadRequestException);
    });

    it('should call transitionStatus with REFUNDED on success', async () => {
      prismaService.order.findUnique.mockResolvedValue({ id: 'id-1', status: OrderStatus.PAID });
      ordersService.transitionStatus.mockResolvedValue(true);

      await service.processRefund('id-1');

      expect(ordersService.transitionStatus).toHaveBeenCalledWith(
        'id-1',
        OrderStatus.REFUNDED,
        'ADMIN',
        'Order refunded manually by admin'
      );
    });
  });
});
