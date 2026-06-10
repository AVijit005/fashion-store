import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

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

      const validItems = (items || []).filter((i: any) => i.id);
      const variantIds = validItems.map((i: any) => i.id);
      
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
      });
      const dbVariantMap = new Map(variants.map(v => [v.id, v]));

      for (const item of validItems) {
        const variant = dbVariantMap.get(item.id);
        if (!variant) throw new BadRequestException(`Variant ${item.id} not found`);
        if (variant.stockQuantity < item.qty) {
          throw new BadRequestException(`Insufficient stock for variant ${item.id}`);
        }

        await tx.productVariant.update({
          where: { id: item.id },
          data: { stockQuantity: { decrement: item.qty } }
        });

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
    
    return this.ordersService.transitionStatus(
      id,
      status,
      'ADMIN',
      'Status updated manually by admin'
    );
  }

  async processRefund(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'PAID') {
      throw new BadRequestException('Order is not paid');
    }
    
    // Process refund using OrdersService to ensure inventory restoration
    return this.ordersService.transitionStatus(
      id,
      'REFUNDED',
      'ADMIN',
      'Order refunded manually by admin'
    );
  }
}
