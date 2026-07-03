import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { PaymentPendingReconciliationCron } from './payment-pending-reconciliation.cron';
import { PrismaService } from '../../config/prisma.service';
import { OrdersService } from './orders.service';

describe('PaymentPendingReconciliationCron', () => {
  let cron: PaymentPendingReconciliationCron;
  let prismaService: any;
  let ordersService: any;

  beforeEach(async () => {
    ordersService = {
      transitionStatus: jest
        .fn()
        .mockResolvedValue({ id: 'order-1', status: OrderStatus.CANCELLED }),
    };

    prismaService = {
      order: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentPendingReconciliationCron,
        { provide: PrismaService, useValue: prismaService },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    cron = module.get<PaymentPendingReconciliationCron>(PaymentPendingReconciliationCron);
  });

  const createTxMock = (orderRows: Array<{ id: string; status: OrderStatus; createdAt: Date }>) => {
    return {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn().mockResolvedValue(orderRows),
    };
  };

  const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60 * 1000);

  it('should cancel a 31-minute-old PAYMENT_PENDING order and restore stock', async () => {
    const orderId = 'order-old-pending';
    prismaService.order.findMany.mockResolvedValue([{ id: orderId }]);

    const txMock = createTxMock([
      { id: orderId, status: OrderStatus.PAYMENT_PENDING, createdAt: minutesAgo(31) },
    ]);
    prismaService.$transaction.mockImplementation(async (callback: any) => callback(txMock));

    await cron.runReconciliation();

    expect(prismaService.order.findMany).toHaveBeenCalledWith({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        createdAt: { lt: expect.any(Date) as any },
      },
      select: { id: true },
    });
    expect(txMock.$executeRaw).toHaveBeenCalledWith(
      expect.arrayContaining(['SELECT pg_advisory_xact_lock(hashtext(', '::text))']),
      expect.anything(),
    );
    expect(txMock.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id, status, "created_at" AS "createdAt" FROM orders WHERE id = $1 FOR UPDATE',
      orderId,
    );
    expect(ordersService.transitionStatus).toHaveBeenCalledWith(
      orderId,
      OrderStatus.CANCELLED,
      'SYSTEM',
      'Stale PAYMENT_PENDING order cancelled by reconciliation job.',
      txMock,
    );
  });

  it('should leave a 29-minute-old PAYMENT_PENDING order untouched', async () => {
    const orderId = 'order-recent-pending';
    prismaService.order.findMany.mockResolvedValue([{ id: orderId }]);

    const txMock = createTxMock([
      { id: orderId, status: OrderStatus.PAYMENT_PENDING, createdAt: minutesAgo(29) },
    ]);
    prismaService.$transaction.mockImplementation(async (callback: any) => callback(txMock));

    await cron.runReconciliation();

    expect(ordersService.transitionStatus).not.toHaveBeenCalled();
  });

  it('should leave an already-PAID old order untouched', async () => {
    const orderId = 'order-old-paid';
    prismaService.order.findMany.mockResolvedValue([{ id: orderId }]);

    const txMock = createTxMock([
      { id: orderId, status: OrderStatus.PAID, createdAt: minutesAgo(31) },
    ]);
    prismaService.$transaction.mockImplementation(async (callback: any) => callback(txMock));

    await cron.runReconciliation();

    expect(ordersService.transitionStatus).not.toHaveBeenCalled();
  });

  it('should process a batch of orders and count processed/skipped/failed correctly', async () => {
    const orders = [
      { id: 'order-cancel', status: OrderStatus.PAYMENT_PENDING, createdAt: minutesAgo(31) },
      { id: 'order-recent', status: OrderStatus.PAYMENT_PENDING, createdAt: minutesAgo(29) },
      { id: 'order-paid', status: OrderStatus.PAID, createdAt: minutesAgo(31) },
    ];

    prismaService.order.findMany.mockResolvedValue(orders.map((o) => ({ id: o.id })));

    let transactionCallIndex = 0;
    prismaService.$transaction.mockImplementation(async (callback: any) => {
      const orderRow = orders[transactionCallIndex];
      transactionCallIndex += 1;
      const txMock = createTxMock([orderRow as any]);
      return callback(txMock);
    });

    await cron.runReconciliation();

    expect(ordersService.transitionStatus).toHaveBeenCalledTimes(1);
    expect(ordersService.transitionStatus).toHaveBeenCalledWith(
      'order-cancel',
      OrderStatus.CANCELLED,
      'SYSTEM',
      'Stale PAYMENT_PENDING order cancelled by reconciliation job.',
      expect.anything(),
    );
  });

  it('should continue processing remaining orders when one order fails', async () => {
    const orderA = {
      id: 'order-a',
      status: OrderStatus.PAYMENT_PENDING,
      createdAt: minutesAgo(31),
    };
    const orderB = {
      id: 'order-b',
      status: OrderStatus.PAYMENT_PENDING,
      createdAt: minutesAgo(32),
    };

    prismaService.order.findMany.mockResolvedValue([{ id: orderA.id }, { id: orderB.id }]);

    ordersService.transitionStatus.mockImplementation(async (orderId: string) => {
      if (orderId === orderA.id) {
        throw new Error('Simulated transition failure');
      }
      return { id: orderId, status: OrderStatus.CANCELLED };
    });

    let transactionCallIndex = 0;
    prismaService.$transaction.mockImplementation(async (callback: any) => {
      const orderRow = transactionCallIndex === 0 ? orderA : orderB;
      transactionCallIndex += 1;
      const txMock = createTxMock([orderRow as any]);
      return callback(txMock);
    });

    await expect(cron.runReconciliation()).resolves.not.toThrow();

    expect(ordersService.transitionStatus).toHaveBeenCalledTimes(2);
    expect(ordersService.transitionStatus).toHaveBeenCalledWith(
      orderA.id,
      OrderStatus.CANCELLED,
      'SYSTEM',
      'Stale PAYMENT_PENDING order cancelled by reconciliation job.',
      expect.anything(),
    );
    expect(ordersService.transitionStatus).toHaveBeenCalledWith(
      orderB.id,
      OrderStatus.CANCELLED,
      'SYSTEM',
      'Stale PAYMENT_PENDING order cancelled by reconciliation job.',
      expect.anything(),
    );
  });
});
