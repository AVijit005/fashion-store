import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { OrdersService } from './orders.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersSweeperService {
  private readonly logger = new Logger(OrdersSweeperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSweeperCron() {
    this.logger.log('Running orders sweeper to clean up orphaned PAYMENT_PENDING orders...');

    const expirationThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        createdAt: {
          lt: expirationThreshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (expiredOrders.length === 0) {
      this.logger.log('No expired PAYMENT_PENDING orders found.');
      return;
    }

    this.logger.log(
      `Found ${expiredOrders.length} expired PAYMENT_PENDING orders. Expiring them...`,
    );

    for (const order of expiredOrders) {
      try {
        await this.ordersService.transitionStatus(
          order.id,
          OrderStatus.FAILED,
          'SYSTEM',
          'Sweeper expired unpaid order after 15 minutes.',
        );
        this.logger.log(`Successfully expired order: ${order.id} via sweeper.`);
      } catch (err) {
        this.logger.error(
          `Failed to expire order ${order.id} via sweeper: ${(err as Error).message}`,
        );
      }
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async pruneExpiredIdempotencyKeys() {
    this.logger.log('Pruning expired idempotency keys...');
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Pruned ${result.count} expired idempotency keys.`);
      }
    } catch (err) {
      this.logger.error(`Failed to prune idempotency keys: ${(err as Error).message}`);
    }
  }
}
