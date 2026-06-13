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
  [OrderStatus.CANCELLED]: [OrderStatus.PAID, OrderStatus.PAYMENT_PENDING],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.FAILED]: [OrderStatus.PAID, OrderStatus.PAYMENT_PENDING],
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

  async applyCoupon(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      throw new NotFoundException('Invalid coupon code');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is no longer active');
    }

    const now = new Date();
    if (now < coupon.validFrom || (coupon.validUntil && now > coupon.validUntil)) {
      throw new BadRequestException('This coupon is expired or not yet valid');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      throw new BadRequestException(`Order value must be at least ₹${coupon.minOrderValue} to use this coupon`);
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.value;
    }

    if (discount > subtotal) discount = subtotal;

    return {
      code: coupon.code,
      discount: Math.round(discount),
    };
  }

  // Checkout and reserve inventory
  async checkout(dto: CheckoutDto, userId?: string) {
    const { guestSessionId, idempotencyKey } = dto;
    
    if (idempotencyKey) {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });
      if (existingKey) {
        if (existingKey.response) {
          return existingKey.response;
        } else {
          throw new BadRequestException('Checkout is already in progress for this request.');
        }
      }
      
      try {
        await this.prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
          }
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          throw new BadRequestException('Checkout is already in progress for this request.');
        }
        throw err;
      }
    }

    const activeUserId = userId || undefined;
    const activeSessionId = activeUserId ? undefined : guestSessionId;

    try {

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

    // Coupon validation will be performed safely inside the transaction with a lock
    let initialDiscountAmount = new Prisma.Decimal(0);
    if (dto.couponCode) {
      try {
        const couponRes = await this.applyCoupon(dto.couponCode, cart.totalAmount);
        initialDiscountAmount = new Prisma.Decimal(couponRes.discount);
      } catch (e: any) {
        throw new BadRequestException(`Coupon error: ${e.message}`);
      }
    }

    // Dynamic inclusive GST calculation of 18%
    const totalDecimal = new Prisma.Decimal(cart.totalAmount);
    const shippingFee = totalDecimal.greaterThan(999) || totalDecimal.equals(0) 
      ? new Prisma.Decimal(0) 
      : new Prisma.Decimal(79);
    const totalAmountBase = totalDecimal;
    const discountedBase = totalAmountBase.sub(initialDiscountAmount);
    // Inclusive tax = Base * (18 / 118)
    const tax = discountedBase.mul(18).div(118);
    const totalAmount = discountedBase.add(shippingFee);

    const guestToken = activeUserId ? null : (guestSessionId || crypto.randomBytes(16).toString('hex'));

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
        
      const existingPendingOrders = await tx.order.findMany({
        where: {
          status: OrderStatus.PAYMENT_PENDING,
          ...(activeUserId ? { userId: activeUserId } : { shippingEmail: dto.shippingEmail }),
        },
      });

      if (existingPendingOrders.length > 0) {
        // Bulk cancel to avoid N+1 queries
        await tx.order.updateMany({
          where: { id: { in: existingPendingOrders.map((o) => o.id) } },
          data: { status: OrderStatus.CANCELLED },
        });
        
        await tx.orderStatusHistory.createMany({
          data: existingPendingOrders.map((o) => ({
            orderId: o.id,
            oldStatus: OrderStatus.PAYMENT_PENDING,
            newStatus: OrderStatus.CANCELLED,
            changedBy: 'SYSTEM',
            reason: 'Auto-cancelled due to new checkout initiation',
          })),
        });

        // Restore inventory for all cancelled orders in one bulk operation
        await this.inventoryService.restoreBulkInventory(
          existingPendingOrders.map((o) => o.id),
          tx
        );
      }

      if (inventoryItems.length > 0) {
        // 1. Reserve inventory
        await this.inventoryService.reserveInventory(inventoryItems, tx);
      }

      if (dto.couponCode) {
        const coupon = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM coupons WHERE code = $1 FOR UPDATE`,
          dto.couponCode.toUpperCase()
        );
        if (!coupon || !coupon[0]) throw new BadRequestException('Invalid coupon code');
        if (coupon[0].usage_limit && coupon[0].usage_count >= coupon[0].usage_limit) {
          throw new BadRequestException('This coupon has reached its usage limit');
        }
        await tx.coupon.update({
          where: { code: dto.couponCode.toUpperCase() },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Create Order
      return tx.order.create({
        data: {
          userId: activeUserId || null,
          guestToken,
          couponCode: dto.couponCode ? dto.couponCode.toUpperCase() : null,
          status: dto.paymentMethod === 'cod' ? OrderStatus.PROCESSING : OrderStatus.PAYMENT_PENDING,
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
          paymentProvider: dto.paymentMethod === 'cod' ? 'COD' : 'RAZORPAY',
          paymentStatus: dto.paymentMethod === 'cod' ? 'COD' : 'PENDING',
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
              newStatus: dto.paymentMethod === 'cod' ? OrderStatus.PROCESSING : OrderStatus.PAYMENT_PENDING,
              changedBy: activeUserId ? 'USER' : 'GUEST',
              reason: dto.paymentMethod === 'cod' ? 'COD checkout completed.' : 'Checkout started, stock reserved.',
            },
          },
        },
      });
    });

    // Schedule expiry job BEFORE making the Razorpay API call (Fix Deadlock)
    // Schedule expiry job ONLY if not COD
    if (dto.paymentMethod !== 'cod') {
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
    }

    // 3. Create Razorpay order (mocked if keys are local mock values)
    if (dto.paymentMethod === 'cod') {
      await this.cartService.clearCart(activeUserId, activeSessionId);
      return {
        orderId: createdOrder.id,
        razorpayOrderId: '',
        amount: totalAmount.toNumber(),
        currency: 'INR',
        guestToken,
      };
    }

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
        const idempotencyKeyReq = `req_${crypto.randomUUID()}`;
        
        let response: Response | undefined;
        let lastErr: any;
        try {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              response = await fetch('https://api.razorpay.com/v1/orders', {
                method: 'POST',
                headers: {
                  Authorization: `Basic ${auth}`,
                  'Content-Type': 'application/json',
                  'Idempotency-Key': idempotencyKeyReq,
                },
                body: JSON.stringify({
                  amount: totalAmount.mul(100).round().toNumber(), // convert to paise precisely using Decimal
                  currency: 'INR',
                  receipt: createdOrder.id,
                }),
                signal: controller.signal,
              });
              break;
            } catch (e) {
              lastErr = e;
              if (attempt === 3) throw e;
              await new Promise((res) => setTimeout(res, attempt * 1000));
            }
          }
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response || !response.ok) {
          const errBody = response ? await response.text() : String(lastErr);
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



    const responseObj = {
      orderId: createdOrder.id,
      razorpayOrderId,
      amount: totalAmount.toNumber(),
      currency: 'INR',
      guestToken,
    };

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { response: responseObj as any },
      }).catch(() => null);
    }

    return responseObj;
    } catch (error) {
      if (idempotencyKey) {
        await this.prisma.idempotencyKey.delete({ where: { key: idempotencyKey } }).catch(() => null);
      }
      throw error;
    }
  }

  // Retry Payment
  async retryPayment(orderId: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId && order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.FAILED && order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Order cannot be retried from its current status');
    }

    if (!order.razorpayOrderId) {
      throw new BadRequestException('Cannot retry this order because it has no Razorpay order ID');
    }

    // Attempt to transition to PAYMENT_PENDING if it was FAILED
    if (order.status === OrderStatus.FAILED) {
      await this.transitionStatus(
        order.id,
        OrderStatus.PAYMENT_PENDING,
        'USER',
        'User initiated payment retry.',
      );
    }

    return {
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.totalAmount.toNumber(),
      currency: 'INR',
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

      // Clear the cart securely after payment confirmation
      await this.cartService.clearCart(order.userId || undefined, order.guestToken || undefined);

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

              // Clear the cart securely after payment capture via webhook
              await this.cartService.clearCart(order.userId || undefined, order.guestToken || undefined);
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
    const orders = await this.prisma.order.findMany({
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
    
    // Map out sensitive internal database fields
    return orders.map(order => ({
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      tax: order.tax,
      status: order.status,
      shippingName: order.shippingName,
      shippingEmail: order.shippingEmail,
      shippingPhone: order.shippingPhone,
      shippingStreet: order.shippingStreet,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      paymentProvider: order.paymentProvider,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items,
    }));
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

    return {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      tax: order.tax,
      status: order.status,
      shippingName: order.shippingName,
      shippingEmail: order.shippingEmail,
      shippingPhone: order.shippingPhone,
      shippingStreet: order.shippingStreet,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      paymentProvider: order.paymentProvider,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items,
      statusHistory: order.statusHistory,
    };
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
        if (order.couponCode) {
          await client.coupon.update({
            where: { code: order.couponCode },
            data: { usageCount: { decrement: 1 } },
          }).catch(() => null);
        }
      }

      if ((newStatus === OrderStatus.PAID || newStatus === OrderStatus.PAYMENT_PENDING) && (currentStatus === OrderStatus.FAILED || currentStatus === OrderStatus.CANCELLED)) {
        const items = await client.orderItem.findMany({
          where: { orderId: orderId, productVariantId: { not: null } }
        });
        if (items.length > 0) {
          const inventoryItems = items.map(item => ({
            variantId: item.productVariantId as string,
            quantity: item.quantity,
          }));
          const allowNegativeStock = newStatus === OrderStatus.PAID;
          try {
            await this.inventoryService.reserveInventory(inventoryItems, client, allowNegativeStock);
          } catch (error) {
             throw new BadRequestException('Cannot retry payment: one or more items have sold out.');
          }
        }
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
