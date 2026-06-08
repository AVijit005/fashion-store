import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders(page: number = 1, limit: number = 50, search?: string, status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { shippingEmail: { contains: search, mode: 'insensitive' } },
        { shippingName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          items: {
            include: {
              productVariant: { include: { product: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createOrder(data: any) {
    const { email, total, items } = data; // items: [{ id, qty }]
    
    // Deduct stock for each item
    for (const item of (items || [])) {
      if (item.id) {
        await this.prisma.productVariant.updateMany({
          where: { id: item.id },
          data: { stockQuantity: { decrement: item.qty } }
        });
      }
    }

    return this.prisma.order.create({
      data: {
        totalAmount: total || 0,
        shippingEmail: email || 'pos@store.com',
        shippingName: email?.split('@')[0] || 'POS Customer',
        shippingPhone: '',
        shippingStreet: 'In-store',
        shippingCity: '',
        shippingState: '',
        shippingPostalCode: '',
        shippingCountry: '',
        status: 'PAID', // POS orders are considered paid
        items: items && items.length > 0 ? {
          create: items.map((item: any) => ({
             productVariantId: item.id || undefined,
             quantity: item.qty || 1,
             priceAtPurchase: 0,
          }))
        } : undefined
      }
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
