import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderExpiryProcessor } from './order-expiry.processor';
import { AbandonedCartCron } from './abandoned-cart.cron';
import { PaymentPendingReconciliationCron } from './payment-pending-reconciliation.cron';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './inventory.service';
import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

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
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderExpiryProcessor,
    InventoryService,
    AbandonedCartCron,
    PaymentPendingReconciliationCron,
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
