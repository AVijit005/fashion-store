import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin.catalog.controller';
import { AdminCatalogService } from './admin.catalog.service';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminOrdersService } from './admin.orders.service';
import { AdminDashboardController } from './admin.dashboard.controller';
import { AdminDashboardService } from './admin.dashboard.service';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminCatalogController, AdminOrdersController, AdminDashboardController],
  providers: [
    AdminCatalogService,
    AdminOrdersService,
    AdminDashboardService,
    PrismaService,
  ],
})
export class AdminModule {}
