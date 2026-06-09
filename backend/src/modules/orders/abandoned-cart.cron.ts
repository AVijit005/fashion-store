import { Injectable, Logger } from '@nestjs/common';
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
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAbandonedCarts() {
    this.logger.log('Running fallback scheduled job to clean up abandoned carts/orders...');

    // Find orders that are PAYMENT_PENDING and created more than 16 minutes ago
    // (giving BullMQ 1 minute of leeway to process it first)
    const sixteenMinutesAgo = new Date();
    sixteenMinutesAgo.setMinutes(sixteenMinutesAgo.getMinutes() - 16);

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        createdAt: { lte: sixteenMinutesAgo },
      },
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
  }
}
