import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../config/prisma.service';
import { CartService } from '../cart/cart.service';
import { CheckoutDto, VerifyPaymentDto } from './dto/orders.dto';
import { OrderStatus, Order, Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service';
import * as crypto from 'crypto';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.FAILED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
    @InjectQueue('order-expiry') private readonly orderExpiryQueue: Queue,
  ) {}

  // Checkout and reserve inventory
  async checkout(dto: CheckoutDto, userId?: string) {
    const { guestSessionId } = dto;
    const activeUserId = userId || undefined;
    const activeSessionId = activeUserId ? undefined : guestSessionId;

    // 1. Fetch current cart
    const cart = await this.cartService.getCart(activeUserId, activeSessionId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cannot checkout with an empty cart');
    }

    const hasOutofStockItems = cart.items.some((item) => !item.isAvailable);
    if (hasOutofStockItems) {
      throw new BadRequestException(
        'Some items in your cart exceed available stock. Please review your cart.',
      );
    }

    // Variant IDs are extracted inside the transaction for sorted locking.

    // Flat shipping fee of ₹100 and dynamic GST calculation of 18%
    const shippingFee = new Prisma.Decimal(100.0);
    const totalAmountBase = new Prisma.Decimal(cart.totalAmount);
    const tax = totalAmountBase.mul(new Prisma.Decimal(0.18));
    const totalAmount = totalAmountBase.add(shippingFee).add(tax);

    const guestToken = activeUserId ? null : crypto.randomBytes(16).toString('hex');

    // 2. Perform DB Transaction for inventory locking and order creation
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // Delegate sorted locking and reservation logic to InventoryService
      await this.inventoryService.reserveInventory(
        cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          sku: item.sku,
        })),
        tx,
      );

      // Create Order
      return tx.order.create({
        data: {
          userId: activeUserId || null,
          guestToken,
          status: OrderStatus.PAYMENT_PENDING,
          totalAmount,
          shippingFee,
          tax,
          shippingName: dto.shippingName,
          shippingEmail: dto.shippingEmail,
          shippingPhone: dto.shippingPhone,
          shippingStreet: dto.shippingStreet,
          shippingCity: dto.shippingCity,
          shippingState: dto.shippingState,
          shippingPostalCode: dto.shippingPostalCode,
          shippingCountry: dto.shippingCountry,
          paymentProvider: 'RAZORPAY',
          paymentStatus: 'PENDING',
          items: {
            create: cart.items.map((item) => ({
              productVariantId: item.variantId,
              quantity: item.quantity,
              priceAtPurchase: new Prisma.Decimal(item.unitPrice),
            })),
          },
          statusHistory: {
            create: {
              newStatus: OrderStatus.PAYMENT_PENDING,
              changedBy: activeUserId ? 'USER' : 'GUEST',
              reason: 'Checkout started, stock reserved.',
            },
          },
        },
      });
    });

    // 3. Create Razorpay order (mocked if keys are local mock values)
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    let razorpayOrderId = `rzp_mock_${crypto.randomUUID().replace(/-/g, '')}`;

    if (keyId !== 'mock_razorpay_key' && !keyId.startsWith('mock')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15s

      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: totalAmount.mul(100).round().toNumber(), // convert to paise precisely using Decimal
            currency: 'INR',
            receipt: createdOrder.id,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Razorpay API error: ${errBody}`);
        }

        const data = (await response.json()) as { id: string };
        razorpayOrderId = data.id;
      } catch (err) {
        clearTimeout(timeoutId);
        // Rollback DB order creation manually if Razorpay API integration fails
        await this.prisma.$transaction(async (tx) => {
          await this.transitionStatus(
            createdOrder.id,
            OrderStatus.FAILED,
            'SYSTEM',
            `Razorpay integration failed: ${(err as Error).message}`,
            tx,
          );
        });

        throw new InternalServerErrorException(
          `Could not create gateway transaction: ${(err as Error).message}`,
        );
      }
    }

    // Save gateway order ID to database
    await this.prisma.order.update({
      where: { id: createdOrder.id },
      data: { razorpayOrderId },
    });

    // 4. Clear the cart
    await this.cartService.clearCart(activeUserId, activeSessionId);

    // 5. Schedule order expiration after 15 minutes (900000 ms) in BullMQ
    await this.orderExpiryQueue.add(
      'expire',
      { orderId: createdOrder.id },
      { delay: 900000, jobId: createdOrder.id }, // deduplicate by order ID
    );

    return {
      orderId: createdOrder.id,
      razorpayOrderId,
      amount: Number(totalAmount),
      currency: 'INR',
      guestToken,
    };
  }

  // Verify payment via direct API submit
  async verifyPayment(dto: VerifyPaymentDto) {
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';

    // Calculate signature
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(dto.razorpaySignature, 'hex');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new BadRequestException('Invalid signature verification');
    }

    // Update order status transactionally with SELECT FOR UPDATE
    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.$queryRawUnsafe<Order[]>(
        `SELECT * FROM orders WHERE "razorpay_order_id" = $1 FOR UPDATE`,
        dto.razorpayOrderId,
      );
      const order = orders[0];

      if (!order) {
        throw new NotFoundException('Order matching payment ID not found');
      }

      if (order.status === OrderStatus.PAID) {
        return { success: true, orderId: order.id, status: order.status };
      }

      await this.transitionStatus(
        order.id,
        OrderStatus.PAID,
        'USER',
        'Payment signature verified.',
        tx,
      );

      await tx.order.update({
        where: { id: order.id },
        data: {
          razorpayPaymentId: dto.razorpayPaymentId,
          razorpaySignature: dto.razorpaySignature,
          paymentStatus: 'PAID',
        },
      });

      return { success: true, orderId: order.id, status: OrderStatus.PAID };
    });
  }

  // Idempotent webhook handler
  async handleWebhook(rawBody: string, signature: string) {
    // Webhook secret — required by env schema (startup fails if not set).
    // No fallback to RAZORPAY_KEY_SECRET: they are different secrets with different purposes.
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    if (!webhookSecret) {
      throw new InternalServerErrorException('Webhook secret is not configured');
    }

    // Webhook verification
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id;
    const eventType = payload.event;

    // Idempotency check: verify if webhook event has already been processed
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (existingEvent) {
      return { status: 'ignored', reason: 'duplicate' };
    }

    // Save event to WebhookEvent table to prevent duplicates
    try {
      await this.prisma.webhookEvent.create({
        data: {
          id: eventId,
          status: 'PROCESSED',
          payload,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { status: 'ignored', reason: 'duplicate' };
      }
      throw err;
    }

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const razorpayOrderId =
        payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
      const razorpayPaymentId = payload.payload?.payment?.entity?.id;

      if (!razorpayOrderId) {
        return { status: 'skipped', reason: 'missing order ID' };
      }

      await this.prisma.$transaction(async (tx) => {
        const orders = await tx.$queryRawUnsafe<Order[]>(
          `SELECT * FROM orders WHERE "razorpay_order_id" = $1 FOR UPDATE`,
          razorpayOrderId,
        );
        const order = orders[0];

        if (!order) {
          return;
        }

        if (order.status !== OrderStatus.PAID) {
          await this.transitionStatus(
            order.id,
            OrderStatus.PAID,
            'WEBHOOK',
            `Payment captured via webhook: ${eventType}`,
            tx,
          );
          await tx.order.update({
            where: { id: order.id },
            data: {
              razorpayPaymentId,
              paymentStatus: 'PAID',
            },
          });
        }
      });
    }

    return { status: 'processed' };
  }

  // Fetch orders for a user
  async getMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get order by ID
  async getOrderById(id: string, userId?: string, guestToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        statusHistory: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Gating check: if order has user, ensure matching user
    if (order.userId) {
      if (order.userId !== userId) {
        throw new NotFoundException('Order not found');
      }
    } else {
      // Guest order
      if (!guestToken || order.guestToken !== guestToken) {
        throw new NotFoundException('Order not found');
      }
    }

    return order;
  }

  // Explicit, validated transition state machine
  async transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    reason?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    // Fetch order with write lock
    const orders = await client.$queryRawUnsafe<Order[]>(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      orderId,
    );
    const order = orders[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status;
    if (currentStatus === newStatus) {
      return order;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid order status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // If order transitions to FAILED or CANCELLED, return stock to inventory
    if (newStatus === OrderStatus.FAILED || newStatus === OrderStatus.CANCELLED) {
      await this.inventoryService.restoreInventory(orderId, client);
    }

    // Update status and append to history
    const updatedOrder = await client.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        statusHistory: {
          create: {
            oldStatus: currentStatus,
            newStatus,
            changedBy,
            reason: reason || `Transitioned status to ${newStatus}`,
          },
        },
      },
    });

    return updatedOrder;
  }
}
