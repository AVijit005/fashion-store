import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrdersService } from './orders.service';
import { OrderStatus } from '@prisma/client';
import { Logger, OnModuleDestroy } from '@nestjs/common';

@Processor('order-expiry')
export class OrderExpiryProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryProcessor.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async onModuleDestroy() {
    this.logger.log('Closing order-expiry worker...');
    if (this.worker) {
      await this.worker.close();
    }
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`Processing order expiry check for order: ${orderId}`);

    try {
      // transitionStatus validates allowed state changes.
      // If the order was paid, transition from PAID -> FAILED is disallowed, throwing a BadRequestException, which is expected.
      await this.ordersService.transitionStatus(
        orderId,
        OrderStatus.FAILED,
        'SYSTEM',
        'Unpaid order expired after 15 minutes.',
      );
      this.logger.log(`Successfully expired order: ${orderId} and returned stock to inventory.`);
    } catch (err) {
      // Log the exception for audit visibility but complete worker execution successfully
      this.logger.debug(
        `Order ${orderId} was not expired (likely already paid or cancelled): ${(err as Error).message}`,
      );
    }
  }
}
