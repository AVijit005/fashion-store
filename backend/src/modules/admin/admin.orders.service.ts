import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        items: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
      },
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    // Simplistic status update for now (ignoring state machine validations)
    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async processRefund(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'PAID') {
      throw new BadRequestException('Order is not paid');
    }
    
    // Mock refund processing
    return this.prisma.order.update({
      where: { id },
      data: { status: 'REFUNDED' },
    });
  }
}
