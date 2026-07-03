import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../config/prisma.service';
import { SettingsService } from '../../config/settings.service';
import { CartService } from '../cart/cart.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../email/email.service';
import { shippingUpdateTemplate } from '../email/templates/shipping-update';
import { refundIssuedTemplate } from '../email/templates/refund-issued';
import { deliveryConfirmedTemplate } from '../email/templates/delivery-confirmed';
import { CheckoutDto, VerifyPaymentDto, CheckoutPricingDto } from './dto/orders.dto';
import { OrderStatus, Order, Prisma, PaymentStatus, PaymentProvider } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { RestockNotificationsService } from '../restock-notifications/restock-notifications.service';
import * as crypto from 'crypto';
import Redis from 'ioredis';

/**
 * Allowed order status transitions.
 *
 * Note: `FAILED -> PAID` was REMOVED in Phase 2 (bug C-C9/H-B14). A failed
 * order must transition back through `PAYMENT_PENDING` (via the retry
 * path) before it can be marked PAID. This closes a forged-status-flip
 * vector where a failed order could be marked paid without going through
 * the retry inventory re-reservation path.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.FAILED]: [OrderStatus.PAYMENT_PENDING],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly restockNotificationsService: RestockNotificationsService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @InjectQueue('order-expiry') private readonly orderExpiryQueue: Queue,
  ) {}

  private async getOrCreateIdempotencyKey(
    idempotencyKey: string,
  ): Promise<{ response?: any } | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const lockHash = crypto
          .createHash('sha256')
          .update(`idempotency_${idempotencyKey}`)
          .digest();
        const lockId = lockHash.readInt32LE(0);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        const existingKey = await tx.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });

        if (existingKey) {
          if (existingKey.response !== null && existingKey.response !== undefined) {
            return { response: existingKey.response };
          }

          const ageMs = Date.now() - existingKey.createdAt.getTime();
          if (ageMs <= 30000) {
            throw new ConflictException('Checkout is already in progress for this request.');
          }

          await tx.idempotencyKey.delete({ where: { key: idempotencyKey } });
        }

        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        return null;
      },
      { timeout: 8000 },
    );
  }

  // Checkout and reserve inventory
  async checkout(dto: CheckoutDto, userId?: string) {
    const { guestSessionId, idempotencyKey } = dto;

    if (idempotencyKey) {
      const cached = await this.getOrCreateIdempotencyKey(idempotencyKey);
      if (cached) {
        return cached.response;
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

      const totalDecimal = new Prisma.Decimal(cart.totalAmount);
      const guestToken = activeUserId
        ? null
        : guestSessionId || crypto.randomBytes(16).toString('hex');

      let discountAmount = new Prisma.Decimal(0);
      let shippingFee = new Prisma.Decimal(0);
      let tax = new Prisma.Decimal(0);
      let totalAmount = new Prisma.Decimal(0);

      // 2. Perform DB Transaction for inventory locking and order creation
      const createdOrder = await this.prisma.$transaction(
        async (tx) => {
          if (dto.paymentMethod === 'cod') {
            const pendingCodCount = await tx.order.count({
              where: {
                paymentProvider: PaymentProvider.COD,
                status: OrderStatus.PROCESSING,
                ...(activeUserId ? { userId: activeUserId } : { shippingEmail: dto.shippingEmail }),
              },
            });
            if (pendingCodCount >= 2) {
              throw new BadRequestException(
                'You have too many unfulfilled COD orders. Please wait for them to be delivered.',
              );
            }
          }

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

            await this.inventoryService.restoreBulkInventory(
              existingPendingOrders.map((o) => o.id),
              tx,
            );

            const couponCodes = existingPendingOrders
              .map((o) => o.couponCode)
              .filter((c): c is string => !!c);
            if (couponCodes.length > 0) {
              const counts = couponCodes.reduce(
                (acc, code) => {
                  acc[code] = (acc[code] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              );

              for (const [code, count] of Object.entries(counts)) {
                await tx.coupon.updateMany({
                  where: { code, usageCount: { gte: count } },
                  data: { usageCount: { decrement: count } },
                });
              }
            }
          }

          if (inventoryItems.length > 0) {
            await this.inventoryService.reserveInventory(inventoryItems, tx);
          }

          if (dto.couponCode) {
            try {
              const couponRes = await this.applyCouponInTransaction(
                tx,
                dto.couponCode,
                cart.totalAmount,
              );
              discountAmount = new Prisma.Decimal(couponRes.discount);
            } catch (e: any) {
              throw new BadRequestException(`Coupon error: ${e.message}`);
            }
          }

          const totals = await this.calculateTotals(totalDecimal, discountAmount);
          shippingFee = totals.shippingFee;
          tax = totals.tax;
          totalAmount = totals.totalAmount;

          return tx.order.create({
            data: {
              userId: activeUserId || null,
              guestToken,
              couponCode: dto.couponCode ? dto.couponCode.toUpperCase() : null,
              status:
                dto.paymentMethod === 'cod' ? OrderStatus.PROCESSING : OrderStatus.PAYMENT_PENDING,
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
              paymentProvider:
                dto.paymentMethod === 'cod' ? PaymentProvider.COD : PaymentProvider.RAZORPAY,
              paymentStatus:
                dto.paymentMethod === 'cod' ? PaymentStatus.COD : PaymentStatus.PENDING,
              items: {
                create: cart.items.map((item) => ({
                  productVariantId: item.variantId || undefined,
                  quantity: item.quantity,
                  priceAtPurchase: new Prisma.Decimal(item.unitPrice),
                  customData: item.customData ? (item.customData as any) : Prisma.JsonNull,
                  // Phase 3 (audit item 3.1): snapshot title + thumbnail + sku
                  // at order time so historical orders still render correctly
                  // even if the product or variant is later deleted.
                  productTitle: item.productTitle,
                  productThumbnail: item.thumbnailUrl ?? null,
                  productSku: item.sku ?? null,
                })),
              },
              statusHistory: {
                create: {
                  newStatus:
                    dto.paymentMethod === 'cod'
                      ? OrderStatus.PROCESSING
                      : OrderStatus.PAYMENT_PENDING,
                  changedBy: activeUserId ? 'USER' : 'GUEST',
                  reason:
                    dto.paymentMethod === 'cod'
                      ? 'COD checkout completed.'
                      : 'Checkout started, stock reserved.',
                },
              },
            },
          });
        },
        { timeout: 8000 },
      );

      // Schedule expiry job before making the Razorpay API call.
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
      } catch (err: any) {
        this.logger.error(`Failed to add order ${createdOrder.id} to expiry queue: ${err.message}`);
      }

      // 3. Handle COD: no gateway call.
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

      // 4. Create Razorpay order via PaymentsService (extracted in Phase 2).
      let razorpayOrderId: string;
      try {
        const gatewayResult = await this.paymentsService.createGatewayOrder({
          amountInPaise: totalAmount.mul(100).round().toNumber(),
          receipt: createdOrder.id,
          idempotencyKey: `checkout_${createdOrder.id}`,
        });
        razorpayOrderId = gatewayResult.razorpayOrderId;
      } catch (err) {
        await this.prisma.$transaction(
          async (tx) => {
            await this.transitionStatus(
              createdOrder.id,
              OrderStatus.FAILED,
              'SYSTEM',
              `Razorpay integration failed: ${(err as Error).message}`,
              tx,
            );
          },
          { timeout: 8000 },
        );

        const message = (err as Error).message || '';
        if (
          message.startsWith('Razorpay API error') ||
          message.startsWith('Circuit breaker open')
        ) {
          throw new BadRequestException(message);
        }

        throw new BadRequestException(
          'Payment gateway is temporarily unavailable. Please try again.',
        );
      }

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
        await this.prisma.idempotencyKey
          .update({
            where: { key: idempotencyKey },
            data: { response: responseObj as any },
          })
          .catch(() => null);
      }

      return responseObj;
    } catch (error: any) {
      if (idempotencyKey) {
        await this.prisma.idempotencyKey
          .delete({
            where: { key: idempotencyKey },
          })
          .catch(() => null);
      }
      throw error;
    }
  }

  async retryPayment(orderId: string, userId?: string, guestToken?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId) {
      if (order.userId !== userId) {
        throw new NotFoundException('Order not found');
      }
    } else {
      if (!guestToken || order.guestToken !== guestToken) {
        throw new NotFoundException('Order not found');
      }
    }

    if (order.status !== OrderStatus.FAILED && order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Order cannot be retried from its current status');
    }

    if (!order.razorpayOrderId) {
      throw new BadRequestException('Cannot retry this order because it has no Razorpay order ID');
    }

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

  async verifyPayment(dto: VerifyPaymentDto, userId?: string, guestToken?: string) {
    // 1. Verify the signature via PaymentsService.
    this.paymentsService.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    // 2. Serialize with a distributed lock per Razorpay order id.
    return this.paymentsService.withPaymentLock(dto.razorpayOrderId, async () => {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { razorpayOrderId: dto.razorpayOrderId },
          });

          // 404 on lookup failure — don't leak whether the order exists.
          if (!order) {
            throw new NotFoundException('Order not found');
          }

          if (order.userId) {
            if (order.userId !== userId) {
              throw new NotFoundException('Order not found');
            }
          } else {
            if (!guestToken || order.guestToken !== guestToken) {
              throw new NotFoundException('Order not found');
            }
          }

          if (order.status === OrderStatus.PAID) {
            if (order.razorpayPaymentId && order.razorpayPaymentId !== dto.razorpayPaymentId) {
              throw new BadRequestException('Order has already been paid with a different payment');
            }
            return {
              success: true,
              orderId: order.id,
              status: order.status,
              cartToClear: null,
            };
          }

          // Transition to PAID inside the same transaction (acquires the
          // FOR UPDATE lock on the orders row).
          await this.transitionStatus(
            order.id,
            OrderStatus.PAID,
            'USER',
            'Payment signature verified.',
            tx,
          );

          const marked = await this.paymentsService.markOrderPaid(
            tx,
            {
              id: order.id,
              status: order.status,
              userId: order.userId,
              guestToken: order.guestToken,
            },
            dto.razorpayPaymentId,
            'USER',
            'Payment signature verified.',
            dto.razorpaySignature,
          );

          return {
            success: true,
            orderId: marked.orderId,
            status: marked.status,
            cartToClear: marked.cartToClear,
          };
        },
        { timeout: 8000 },
      );

      if (result.cartToClear) {
        const cart = result.cartToClear;
        await this.cartService.clearCart(cart.userId, cart.guestToken);
      }

      return { success: true, orderId: result.orderId, status: result.status };
    });
  }

  // ---------- Coupons ----------

  async previewTotals(dto: CheckoutPricingDto, userId?: string) {
    const activeUserId = userId || undefined;
    const activeSessionId = activeUserId ? undefined : dto.guestSessionId;
    const cart = await this.cartService.getCart(activeUserId, activeSessionId);
    const subtotal = new Prisma.Decimal(cart.totalAmount);

    let discountAmount = new Prisma.Decimal(0);
    if (dto.couponCode) {
      const couponRes = await this.applyCoupon(dto.couponCode, cart.totalAmount);
      discountAmount = new Prisma.Decimal(couponRes.discount);
    }

    const totals = await this.calculateTotals(subtotal, discountAmount);
    return {
      subtotal: subtotal.toNumber(),
      discount: discountAmount.toNumber(),
      shippingFee: totals.shippingFee.toNumber(),
      tax: totals.tax.toNumber(),
      totalAmount: totals.totalAmount.toNumber(),
      currency: 'INR',
    };
  }

  async applyCoupon(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) throw new NotFoundException('Invalid coupon code');
    if (!coupon.isActive) throw new BadRequestException('This coupon is no longer active');

    const now = new Date();
    if (now < coupon.validFrom || (coupon.validUntil && now > coupon.validUntil)) {
      throw new BadRequestException('This coupon is expired or not yet valid');
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.minOrderValue && subtotal < (coupon.minOrderValue as any).toNumber()) {
      throw new BadRequestException(
        `Order value must be at least ₹${(coupon.minOrderValue as any).toNumber()} to use this coupon`,
      );
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * Number(coupon.value)) / 100;
      if (coupon.maxDiscount && discount > (coupon.maxDiscount as any).toNumber()) {
        discount = (coupon.maxDiscount as any).toNumber();
      }
    } else {
      discount = (coupon.value as any).toNumber();
    }
    if (discount > subtotal) discount = subtotal;

    return { code: coupon.code, discount: Math.round(discount) };
  }

  private async calculateTotals(totalDecimal: Prisma.Decimal, discountAmount: Prisma.Decimal) {
    const discountedBase = totalDecimal.sub(discountAmount);
    const settings = await this.settingsService.getAll();
    const shippingFee =
      discountedBase.greaterThan(settings.shipping.freeThreshold) || discountedBase.equals(0)
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(settings.shipping.flatRate);
    const tax = discountedBase.mul(settings.tax.gstPercent).div(100 + settings.tax.gstPercent);
    const totalAmount = discountedBase.add(shippingFee);
    return { discountedBase, shippingFee, tax, totalAmount };
  }

  private async applyCouponInTransaction(
    tx: Prisma.TransactionClient,
    code: string,
    subtotal: number,
  ) {
    const couponCode = code.toUpperCase();
    // Tagged template instead of $queryRawUnsafe — H-B2.
    const coupons = await tx.$queryRaw<
      Array<{
        id: string;
        code: string;
        type: 'PERCENTAGE' | 'FIXED';
        value: Prisma.Decimal;
        is_active: boolean;
        valid_from: Date;
        valid_until: Date | null;
        usage_limit: number | null;
        usage_count: number;
        min_order_value: Prisma.Decimal | null;
        max_discount: Prisma.Decimal | null;
      }>
    >`SELECT id, code, type, value, is_active, valid_from, valid_until,
             usage_limit, usage_count, min_order_value, max_discount
        FROM coupons
       WHERE code = ${couponCode}
         FOR UPDATE`;
    const coupon = coupons[0];

    if (!coupon) throw new NotFoundException('Invalid coupon code');
    if (!coupon.is_active) throw new BadRequestException('This coupon is no longer active');

    const now = new Date();
    if (now < coupon.valid_from || (coupon.valid_until && now > coupon.valid_until)) {
      throw new BadRequestException('This coupon is expired or not yet valid');
    }
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.min_order_value && subtotal < parseFloat(coupon.min_order_value.toString())) {
      throw new BadRequestException(
        `Order value must be at least ₹${coupon.min_order_value} to use this coupon`,
      );
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * Number(coupon.value)) / 100;
      if (coupon.max_discount && discount > parseFloat(coupon.max_discount.toString())) {
        discount = parseFloat(coupon.max_discount.toString());
      }
    } else {
      discount = Number(coupon.value);
    }
    if (discount > subtotal) discount = subtotal;

    await tx.coupon.update({
      where: { code: couponCode },
      data: { usageCount: { increment: 1 } },
    });

    return { code: couponCode, discount: Math.round(discount) };
  }

  // ---------- Queries ----------

  /**
   * Fetch the user's orders. Does NOT include statusHistory (internal
   * audit data) — see getOrderByIdAdmin for that.
   */
  async getMyOrders(userId: string, limit = 10, offset = 0) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: { id: true, title: true, slug: true, basePrice: true, mediaUrls: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return orders.map((order) => this.toUserOrderDto(order));
  }

  /**
   * Fetch a single user-owned order. Does NOT include statusHistory.
   */
  async getOrderById(id: string, userId?: string, guestToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: { id: true, title: true, slug: true, basePrice: true, mediaUrls: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.userId) {
      if (order.userId !== userId) throw new NotFoundException('Order not found');
    } else {
      if (!guestToken || order.guestToken !== guestToken) {
        throw new NotFoundException('Order not found');
      }
    }

    return this.toUserOrderDto(order);
  }

  /**
   * Admin variant — includes statusHistory with changedBy / reason fields.
   * Callers must be authenticated as ADMIN (enforced at the controller).
   */
  async getOrderByIdAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: { id: true, title: true, slug: true, basePrice: true, mediaUrls: true },
                },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      ...this.toUserOrderDto(order),
      statusHistory: order.statusHistory,
    };
  }

  // ---------- State machine ----------

  /**
   * Atomic order status transition. `tx` is REQUIRED — there is no
   * fallback to a fresh transaction (H-B15). The caller's transaction
   * must hold the FOR UPDATE lock on the order row, which is acquired
   * by the tagged-template SELECT below.
   */
  async transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    reason?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Order> {
    if (!tx) {
      throw new BadRequestException(
        'transitionStatus must be called inside an existing transaction',
      );
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: OrderStatus;
        user_id: string | null;
        guest_token: string | null;
        coupon_code: string | null;
      }>
    >`SELECT id, status, user_id, guest_token, coupon_code
        FROM orders
       WHERE id = ${orderId}
         FOR UPDATE`;
    const order = rows[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status as OrderStatus;
    if (currentStatus === newStatus) {
      // No-op transition — return the existing order.
      const existing = await tx.order.findUnique({ where: { id: orderId } });
      return existing!;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid order status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    if (newStatus === OrderStatus.FAILED || newStatus === OrderStatus.CANCELLED) {
      await this.inventoryService.restoreInventory(orderId, tx);
      if (order.coupon_code) {
        await tx.coupon
          .updateMany({
            where: { code: order.coupon_code, usageCount: { gte: 1 } },
            data: { usageCount: { decrement: 1 } },
          })
          .catch(() => null);
      }
    }

    if (
      (newStatus === OrderStatus.PAID || newStatus === OrderStatus.PAYMENT_PENDING) &&
      (currentStatus === OrderStatus.FAILED || currentStatus === OrderStatus.CANCELLED)
    ) {
      const items = await tx.orderItem.findMany({
        where: { orderId, productVariantId: { not: null } },
      });
      if (items.length > 0) {
        const inventoryItems = items.map((item) => ({
          variantId: item.productVariantId as string,
          quantity: item.quantity,
        }));
        try {
          await this.inventoryService.reserveInventory(inventoryItems, tx, false);
        } catch {
          throw new BadRequestException('Cannot retry payment: one or more items have sold out.');
        }
      }
    }

    const updatedOrder = await tx.order.update({
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

    // Phase 9: best-effort transactional emails. Sent inside the tx
    // (best-effort; if the tx rolls back after this, a stray email may
    // be sent for a non-existent order). Harmless for the customer; the
    // worst case is one duplicate.
    if (
      newStatus === OrderStatus.SHIPPED ||
      newStatus === OrderStatus.REFUNDED ||
      newStatus === OrderStatus.DELIVERED
    ) {
      try {
        if (newStatus === OrderStatus.SHIPPED) {
          await this.sendShippingUpdateEmail(tx, orderId);
        } else if (newStatus === OrderStatus.REFUNDED) {
          await this.sendRefundEmail(tx, orderId, reason);
        } else {
          await this.sendDeliveryConfirmedEmail(tx, orderId);
        }
      } catch (err) {
        this.logger.error(
          `Failed to enqueue status email for order ${orderId} (${newStatus}): ${(err as Error).message}`,
        );
      }
    }

    this.auditService.create({
      userId: updatedOrder.userId || undefined,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      details: {
        orderId,
        oldStatus: currentStatus,
        newStatus,
        changedBy,
        reason,
      },
    });

    return updatedOrder;
  }

  async processRazorpayRefund(paymentId: string, amount: number): Promise<void> {
    const amountInPaise = Math.round(amount * 100);
    await this.paymentsService.refundPayment(paymentId, amountInPaise);
  }

  // ---------- Helpers ----------

  /**
   * User-facing projection of an order. Deliberately omits:
   *   - statusHistory (audit data, admin-only)
   *   - razorpaySignature (gateway-internal)
   */
  private toUserOrderDto(order: Order & { items?: unknown[] }) {
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
      couponCode: order.couponCode,
      guestToken: order.guestToken,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
    };
  }

  // ---------- Phase 9: transactional email senders ----------

  private async sendShippingUpdateEmail(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const fullOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!fullOrder) return;

    const recipientEmail = fullOrder.user?.email ?? fullOrder.shippingEmail;
    if (!recipientEmail) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const orderUrl = `${frontendUrl.replace(/\/$/, '')}/account?order=${encodeURIComponent(orderId)}`;

    const template = shippingUpdateTemplate({
      name: fullOrder.user?.name ?? null,
      orderShortId: orderId.slice(0, 8).toUpperCase(),
      orderUrl,
    });
    await this.emailService.sendTemplate(recipientEmail, template);
  }

  private async sendRefundEmail(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason?: string,
  ): Promise<void> {
    const fullOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!fullOrder) return;

    const recipientEmail = fullOrder.user?.email ?? fullOrder.shippingEmail;
    if (!recipientEmail) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const orderUrl = `${frontendUrl.replace(/\/$/, '')}/account?order=${encodeURIComponent(orderId)}`;

    const refundAmount =
      Number(fullOrder.totalAmount) + Number(fullOrder.shippingFee) + Number(fullOrder.tax);

    const template = refundIssuedTemplate({
      name: fullOrder.user?.name ?? null,
      orderShortId: orderId.slice(0, 8).toUpperCase(),
      refundAmount,
      currency: 'INR',
      reason,
      orderUrl,
    });
    await this.emailService.sendTemplate(recipientEmail, template);
  }

  private async sendDeliveryConfirmedEmail(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const fullOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!fullOrder) return;

    const recipientEmail = fullOrder.user?.email ?? fullOrder.shippingEmail;
    if (!recipientEmail) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const orderUrl = `${frontendUrl.replace(/\/$/, '')}/account?order=${encodeURIComponent(orderId)}`;

    const template = deliveryConfirmedTemplate({
      name: fullOrder.user?.name ?? null,
      orderShortId: orderId.slice(0, 8).toUpperCase(),
      orderUrl,
    });
    await this.emailService.sendTemplate(recipientEmail, template);
  }
}
