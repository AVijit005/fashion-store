import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
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
  [OrderStatus.CANCELLED]: [OrderStatus.PAID],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.FAILED]: [OrderStatus.PAID],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
      // Only reserve inventory for standard variant items
      const inventoryItems = cart.items
        .filter((item) => item.variantId !== null)
        .map((item) => ({
          variantId: item.variantId as string,
          quantity: item.quantity,
          sku: item.sku as string,
        }));
        
      if (inventoryItems.length > 0) {
        await this.inventoryService.reserveInventory(inventoryItems, tx);
      }

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
              productVariantId: item.variantId || undefined,
              quantity: item.quantity,
              priceAtPurchase: new Prisma.Decimal(item.unitPrice),
              customData: item.customData ? (item.customData as any) : Prisma.JsonNull,
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

    // Schedule expiry job BEFORE making the Razorpay API call (Fix Deadlock)
    try {
      await this.orderExpiryQueue.add(
        'expire',
        { orderId: createdOrder.id },
        {
          delay: 900000,
          jobId: createdOrder.id,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule expiry job for orderId=${createdOrder.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // 3. Create Razorpay order (mocked if keys are local mock values)
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    let razorpayOrderId = `rzp_mock_${crypto.randomUUID().replace(/-/g, '')}`;

    if (!keyId.startsWith('mock')) {
      if (!/^rzp_(test|live)_/.test(keyId) || keySecret.length < 8) {
        await this.prisma.$transaction(async (tx) => {
          await this.transitionStatus(
            createdOrder.id,
            OrderStatus.FAILED,
            'SYSTEM',
            'Razorpay credentials are not configured.',
            tx,
          );
        });
        throw new InternalServerErrorException('Payment gateway is not configured');
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15s

      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const idempotencyKey = `req_${crypto.randomUUID()}`;
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
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



    return {
      orderId: createdOrder.id,
      razorpayOrderId,
      amount: totalAmount.toNumber(),
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

    let expectedBuffer: Buffer;
    let actualBuffer: Buffer;
    try {
      expectedBuffer = Buffer.from(expectedSignature, 'hex');
      actualBuffer = Buffer.from(dto.razorpaySignature, 'hex');
    } catch {
      throw new BadRequestException('Malformed signature encoding');
    }

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
        if (order.razorpayPaymentId && order.razorpayPaymentId !== dto.razorpayPaymentId) {
          throw new BadRequestException('Order has already been paid with a different payment');
        }
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

    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Invalid or missing webhook signature');
    }

    let expectedBuffer: Buffer;
    let actualBuffer: Buffer;
    try {
      expectedBuffer = Buffer.from(expectedSignature, 'hex');
      actualBuffer = Buffer.from(signature, 'hex');
    } catch {
      throw new BadRequestException('Malformed webhook signature encoding');
    }

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
    const eventId = payload.id;
    const eventType = payload.event;
    if (!eventId || !eventType) {
      throw new BadRequestException('Webhook payload is missing event metadata');
    }

    let status: string;
    try {
      status = await this.prisma.$transaction(async (tx) => {
        let result = 'processed';

        if (eventType === 'order.paid' || eventType === 'payment.captured') {
          const razorpayOrderId =
            payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
          const razorpayPaymentId = payload.payload?.payment?.entity?.id;

          if (!razorpayOrderId) {
            result = 'skipped';
          } else {
            const orders = await tx.$queryRawUnsafe<Order[]>(
              `SELECT * FROM orders WHERE "razorpay_order_id" = $1 FOR UPDATE`,
              razorpayOrderId,
            );
            const order = orders[0];

            if (!order) {
              result = 'skipped';
            } else if (order.status !== OrderStatus.PAID) {
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
          }
        } else {
          result = 'skipped';
        }

        // Record successful or skipped event inside the transaction
        // This leverages Postgres unique constraints for true concurrency safety.
        await tx.webhookEvent.create({
          data: {
            id: eventId,
            status: result,
            payload: payload as any,
          },
        });

        return result;
      });
    } catch (error: any) {
      // P2002 is Prisma's Unique Constraint Violation error code
      if (error.code === 'P2002') {
        this.logger.warn(`Duplicate webhook received and ignored: ${eventId}`);
        return { status: 'ignored', reason: 'duplicate' };
      }
      this.logger.error(`Webhook transaction failed: ${error.message}`, error.stack);
      throw error;
    }

    return { status };
  }

  // Fetch orders for a user
  async getMyOrders(userId: string, limit = 10, offset = 0) {
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
      take: limit,
      skip: offset,
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
    const execute = async (client: Prisma.TransactionClient) => {
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
    };

    if (tx) {
      return execute(tx);
    }
    return this.prisma.$transaction(execute);
  }
}
