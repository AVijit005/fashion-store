import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AdminOrdersService } from './admin.orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';

@Controller('admin/orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: AdminOrdersService) {}

  @Get()
  async getOrders() {
    return this.ordersService.getOrders();
  }

  @Put(':id/status')
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  @Post(':id/refund')
  async processRefund(@Param('id') id: string) {
    return this.ordersService.processRefund(id);
  }
}
