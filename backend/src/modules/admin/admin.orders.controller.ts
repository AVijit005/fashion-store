import { Controller, Get, Put, Post, Patch, Param, Body, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { AdminOrdersService } from './admin.orders.service';
import { CreatePosOrderDto, UpdateBulkStatusDto } from './dto/admin.orders.dto';
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
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
    return this.ordersService.getOrders(pageNum, limitNum, q, status);
  }

  @Post()
  async createOrder(@Body() body: CreatePosOrderDto) {
    return this.ordersService.createOrder(body);
  }

  @Put(':id/status')
  async updateOrderStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: OrderStatus) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  @Post(':id/refund')
  async processRefund(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.processRefund(id);
  }

  @Patch('bulk-status')
  async updateBulkOrderStatus(@Body() dto: UpdateBulkStatusDto) {
    return this.ordersService.updateBulkOrderStatus(dto.orderIds, dto.status);
  }
}
