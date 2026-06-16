import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

@Injectable()
export class AbandonedCartCron {
  private readonly logger = new Logger(AbandonedCartCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAbandonedCarts() {
    const lockKey = 'cron:abandoned-carts:lock';
    // Attempt to acquire lock for 4 minutes
    const lockAcquired = await this.redis.set(lockKey, 'locked', 'EX', 240, 'NX');
    
    if (!lockAcquired) {
      this.logger.debug('Abandoned carts cron is already running on another pod. Skipping.');
      return;
    }

    this.logger.log('Running fallback scheduled job to clean up abandoned carts/orders...');

    try {
      // Find orders that are PAYMENT_PENDING and created more than 16 minutes ago
      // (giving BullMQ 1 minute of leeway to process it first)
      const sixteenMinutesAgo = new Date();
      sixteenMinutesAgo.setMinutes(sixteenMinutesAgo.getMinutes() - 16);

      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PAYMENT_PENDING,
          createdAt: { lte: sixteenMinutesAgo },
        },
        select: { id: true },
      });

    if (expiredOrders.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredOrders.length} expired orders missed by Queue. Processing...`);

    for (const order of expiredOrders) {
      try {
        await this.ordersService.transitionStatus(
          order.id,
          OrderStatus.FAILED,
          'SYSTEM',
          'Cron Sweep: Unpaid order expired.',
        );
        this.logger.log(`Successfully expired order: ${order.id} via Cron.`);
      } catch (err) {
        this.logger.debug(`Failed to expire order ${order.id} via Cron: ${(err as Error).message}`);
      }
    }
    } finally {
      // We can let the lock expire, or remove it early if done
      await this.redis.del(lockKey);
    }
  }
}
