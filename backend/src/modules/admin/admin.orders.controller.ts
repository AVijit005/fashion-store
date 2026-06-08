import { Controller, Get, Put, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
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
  async getOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.ordersService.getOrders(pageNum, limitNum, q, status);
  }

  @Post()
  async createOrder(@Body() body: any) {
    return this.ordersService.createOrder(body);
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
