import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OrdersService } from './orders.service';

@Injectable()
export class PaymentPendingReconciliationCron {
  private readonly logger = new Logger(PaymentPendingReconciliationCron.name);
  private static readonly STALE_THRESHOLD_MS = 30 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runReconciliation(): Promise<void> {
    const cutoff = new Date(Date.now() - PaymentPendingReconciliationCron.STALE_THRESHOLD_MS);

    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (staleOrders.length === 0) {
      this.logger.debug('No stale PAYMENT_PENDING orders found.');
      return;
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const { id } of staleOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}::text))`;

          const orders = await tx.$queryRawUnsafe<
            { id: string; status: OrderStatus; createdAt: Date }[]
          >(
            'SELECT id, status, "created_at" AS "createdAt" FROM orders WHERE id = $1 FOR UPDATE',
            id,
          );
          const order = orders[0];

          if (!order) {
            skipped += 1;
            return;
          }

          if (order.status !== OrderStatus.PAYMENT_PENDING || order.createdAt >= cutoff) {
            skipped += 1;
            return;
          }

          await this.ordersService.transitionStatus(
            id,
            OrderStatus.CANCELLED,
            'SYSTEM',
            'Stale PAYMENT_PENDING order cancelled by reconciliation job.',
            tx,
          );

          processed += 1;
        });
      } catch (err) {
        failed += 1;
        this.logger.error(
          `Failed to cancel stale PAYMENT_PENDING order ${id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    this.logger.log(
      `PAYMENT_PENDING reconciliation complete: ${processed} cancelled, ${skipped} skipped, ${failed} failed out of ${staleOrders.length} stale orders.`,
    );
  }
}
