import { DynamicModule, Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { OrderExpiryProcessor } from '../orders/order-expiry.processor';
import { AbandonedCartCron } from '../orders/abandoned-cart.cron';
import { PaymentPendingReconciliationCron } from '../orders/payment-pending-reconciliation.cron';

/**
 * WorkerModule owns the BullMQ processors and @Cron scheduled jobs
 * (OrderExpiryProcessor, AbandonedCartCron, PaymentPendingReconciliationCron).
 *
 * Why split?
 * --------
 * In the original codebase these providers lived in OrdersModule, which meant
 * every API replica also spun up a copy of each worker. With N API replicas,
 * the same BullMQ queue had N consumers competing for every job — the job
 * lock ensured correctness, but throughput suffered and every replica
 * ran an idle cron scheduler. In production, this is wasteful and noisy.
 *
 * Now the API replica imports `WorkerModule.forRoot({ enabled: false })`,
 * which returns an empty module \u2014 no worker classes are provided, so
 * NestJS never instantiates them, the @Processor decorator never
 * subscribes to BullMQ, and the @Cron decorators are inert.
 *
 * The dedicated worker replica imports `WorkerModule.forRoot({ enabled: true })`,
 * which imports OrdersModule (for OrdersService / InventoryService),
 * provides all three worker classes, and lets them run.
 *
 * Usage:
 *   // API replica  -> RUN_WORKERS=false node dist/main.js
 *   // Worker replica -> RUN_WORKERS=true  node dist/worker.js
 */
@Module({})
export class WorkerModule {
  static forRoot({ enabled }: { enabled: boolean }): DynamicModule {
    if (!enabled) {
      // API replica: ship an empty module. No worker providers means
      // no @Processor / @Cron classes get instantiated, so BullMQ
      // subscription and cron scheduling are completely absent here.
      return { module: WorkerModule };
    }

    return {
      module: WorkerModule,
      // Importing OrdersModule gives the workers access to OrdersService,
      // InventoryService, etc. The BullMQ queue registration (producer
      // side) lives in OrdersModule and is loaded by BOTH replicas so
      // API calls can enqueue jobs even from a process with no consumer.
      imports: [OrdersModule],
      providers: [OrderExpiryProcessor, AbandonedCartCron, PaymentPendingReconciliationCron],
      exports: [OrderExpiryProcessor, AbandonedCartCron, PaymentPendingReconciliationCron],
    };
  }
}
