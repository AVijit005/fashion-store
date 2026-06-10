import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin.catalog.controller';
import { AdminCatalogService } from './admin.catalog.service';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminOrdersService } from './admin.orders.service';
import { AdminDashboardController } from './admin.dashboard.controller';
import { AdminDashboardService } from './admin.dashboard.service';
import { AdminCustomersController } from './admin.customers.controller';
import { AdminCustomersService } from './admin.customers.service';
import { AdminDropsController } from './admin.drops.controller';
import { AdminDropsService } from './admin.drops.service';
import { AdminStudioController } from './admin.studio.controller';
import { AdminStudioService } from './admin.studio.service';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminCatalogController,
    AdminOrdersController,
    AdminDashboardController,
    AdminCustomersController,
    AdminDropsController,
    AdminStudioController,
  ],
  providers: [
    AdminCatalogService,
    AdminOrdersService,
    AdminDashboardService,
    AdminCustomersService,
    AdminDropsService,
    AdminStudioService,
    PrismaService,
  ],
})
export class AdminModule {}
