import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderExpiryProcessor } from './order-expiry.processor';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryService } from './inventory.service';
import { OrdersSweeperService } from './orders-sweeper.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-expiry',
    }),
    CartModule,
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpiryProcessor, InventoryService, OrdersSweeperService],
  exports: [OrdersService, InventoryService],
})
export class OrdersModule {}
