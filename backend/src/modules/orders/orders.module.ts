import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './inventory.service';
import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EmailModule } from '../email/email.module';
import { RestockNotificationsModule } from '../restock-notifications/restock-notifications.module';

/**
 * OrdersModule is the HTTP + lifecycle surface for orders.
 *
 * Phase 6 split: the BullMQ processor (OrderExpiryProcessor) and the
 * @Cron jobs (AbandonedCartCron, PaymentPendingReconciliationCron)
 * were moved to WorkerModule. API replicas now import this module
 * without workers; the dedicated worker replica imports WorkerModule
 * separately. See worker.module.ts for the rationale.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-expiry',
    }),
    CartModule,
    AuthModule,
    AuditModule,
    PaymentsModule,
    WebhooksModule,
    EmailModule,
    RestockNotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    InventoryService,
    // Phase 6: OrderExpiryProcessor, AbandonedCartCron, and
    // PaymentPendingReconciliationCron were moved to WorkerModule.
    // They're no longer provided here so the API replica doesn't
    // spin up duplicate BullMQ consumers or duplicate cron schedules.
  ],
  exports: [OrdersService, InventoryService],
})
export class OrdersModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret || secret.trim() === '') {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: RAZORPAY_KEY_SECRET is missing or empty. Refusing to start.',
      );
    }
  }
}
