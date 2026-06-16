import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../orders/inventory.service';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getOrders(page: number = 1, limit: number = 50, search?: string, status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      if (search.length < 3)
        throw new BadRequestException('Search term must be at least 3 characters');
      if (search.length > 100)
        throw new BadRequestException('Search term cannot exceed 100 characters');
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
        include: { product: true },
      });
      const dbVariantMap = new Map(variants.map((v) => [v.id, v]));

      for (const item of validItems) {
        const variant = dbVariantMap.get(item.id);
        if (!variant) throw new BadRequestException(`Variant ${item.id} not found`);

        orderItemsData.push({
          productVariantId: variant.id,
          quantity: item.qty,
          priceAtPurchase: variant.priceOverride || variant.product.basePrice,
        });
      }

      await this.inventoryService.reserveInventory(
        validItems.map((i: any) => ({
          variantId: i.id,
          quantity: i.qty,
          sku: dbVariantMap.get(i.id)?.sku || '',
        })),
        tx,
      );

      const calculatedTotal = orderItemsData.reduce(
        (acc, item) => acc + item.quantity * Number(item.priceAtPurchase),
        0,
      );

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
          status: OrderStatus.PAID, // POS orders are considered paid
          paymentStatus: PaymentStatus.PAID,
          paymentProvider: PaymentProvider.COD,
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
      'Status updated manually by admin',
    );
  }

  async processRefund(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Order is not paid');
    }

    // Process refund using OrdersService to ensure inventory restoration
    return this.ordersService.transitionStatus(
      id,
      OrderStatus.REFUNDED,
      'ADMIN',
      'Order refunded manually by admin',
    );
  }

  async updateBulkOrderStatus(orderIds: string[], status: OrderStatus) {
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException('No order IDs provided');
    }
    if (orderIds.length > 100) {
      throw new BadRequestException('Cannot bulk update more than 100 orders at once');
    }

    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const id of orderIds) {
      try {
        await this.updateOrderStatus(id, status);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({ id, message: error.message });
      }
    }

    return results;
  }
}
