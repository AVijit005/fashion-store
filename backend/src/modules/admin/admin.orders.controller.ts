import { Controller, Get, Put, Post, Patch, Param, Body, UseGuards, Query, ParseUUIDPipe, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AdminOrdersService } from './admin.orders.service';
import { CreatePosOrderDto, UpdateBulkStatusDto } from './dto/admin.orders.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';

@Controller('admin/orders')
@Throttle({ default: { limit: 60, ttl: 60000 } })
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
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
    @Req() req: Request,
  ) {
    const adminUserId = (req as any).user?.id as string | undefined;
    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim();
    return this.ordersService.updateOrderStatus(id, status, undefined, adminUserId, ipAddress);
  }

  @Post(':id/refund')
  async processRefund(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const adminUserId = (req as any).user?.id as string | undefined;
    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim();
    return this.ordersService.processRefund(id, adminUserId, ipAddress);
  }

  @Patch('bulk-status')
  async updateBulkOrderStatus(@Body() dto: UpdateBulkStatusDto, @Req() req: Request) {
    const adminUserId = (req as any).user?.id as string | undefined;
    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim();
    return this.ordersService.updateBulkOrderStatus(dto.orderIds, dto.status, adminUserId, ipAddress);
  }
}
