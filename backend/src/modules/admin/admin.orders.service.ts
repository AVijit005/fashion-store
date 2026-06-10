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
    const { email, items } = data; // items: [{ id, qty }]
    
    return this.prisma.$transaction(async (tx) => {
      const orderItemsData = [];

      // Deduct stock for each item safely
      for (const item of (items || [])) {
        if (!item.id) continue;
        
        const variant = await tx.productVariant.findUnique({
          where: { id: item.id },
          include: { product: true }
        });

        if (!variant) throw new BadRequestException(`Variant ${item.id} not found`);

        const res = await tx.productVariant.updateMany({
          where: { id: item.id, stockQuantity: { gte: item.qty } },
          data: { stockQuantity: { decrement: item.qty } }
        });

        if (res.count === 0) {
          throw new BadRequestException(`Insufficient stock for variant ${item.id}`);
        }

        orderItemsData.push({
          productVariantId: variant.id,
          quantity: item.qty,
          priceAtPurchase: variant.priceOverride || variant.product.basePrice,
        });
      }

      const calculatedTotal = orderItemsData.reduce((acc, item) => acc + (item.quantity * Number(item.priceAtPurchase)), 0);

      return tx.order.create({
        data: {
          totalAmount: calculatedTotal,
          shippingEmail: email || 'pos@store.com',
          shippingName: email?.split('@')[0] || 'POS Customer',
          shippingPhone: '',
          shippingStreet: 'In-store',
          shippingCity: '',
          shippingState: '',
          shippingPostalCode: '',
          shippingCountry: '',
          status: 'PAID', // POS orders are considered paid
          paymentStatus: 'COMPLETED',
          paymentProvider: 'POS',
          items: {
            create: orderItemsData,
          },
        },
      });
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
    
    // Mock refund processing using atomic update
    const res = await this.prisma.order.updateMany({
      where: { id, status: 'PAID' },
      data: { status: 'REFUNDED' },
    });
    
    if (res.count === 0) {
      throw new BadRequestException('Order is not paid or already refunded');
    }

    return this.prisma.order.findUnique({ where: { id } });
  }
}
