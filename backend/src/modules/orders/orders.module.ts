import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderExpiryProcessor } from './order-expiry.processor';
import { AbandonedCartCron } from './abandoned-cart.cron';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryService } from './inventory.service';


@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-expiry',
    }),
    CartModule,
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderExpiryProcessor,
    InventoryService,
    AbandonedCartCron,
  ],
  exports: [OrdersService, InventoryService],
})
export class OrdersModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret || secret.trim() === '') {
      throw new Error('CRITICAL CONFIGURATION ERROR: RAZORPAY_KEY_SECRET is missing or empty. Refusing to start.');
    }
  }
}
