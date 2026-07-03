import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CartService } from '../cart/cart.service';
import { OrderStatus, Order, WebhookEventStatus } from '@prisma/client';

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
}

interface RazorpayWebhookPayload {
  id?: string;
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayPaymentEntity };
  };
}

export interface WebhookHandleResult {
  status: WebhookEventStatus | 'IGNORED';
  reason?: string;
}

/**
 * WebhooksService owns inbound Razorpay webhook processing.
 *
 * Responsibilities:
 *   - signature verification (delegated to PaymentsService so the secret
 *     only lives in one place)
 *   - JSON parsing + minimal validation
 *   - idempotency via the `WebhookEvent` table (Razorpay event id is the
 *     primary key; duplicate inserts are silently dropped)
 *   - order state transition to PAID via PaymentsService.withPaymentLock
 *
 * Extracted from OrdersService.handleWebhook in Phase 2.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly cartService: CartService,
  ) {}

  async handleRazorpayWebhook(rawBody: string, signature: string): Promise<WebhookHandleResult> {
    // 1. Verify signature first — never even parse the body of an
    //    unauthenticated request.
    this.paymentsService.verifyWebhookSignature(rawBody, signature);

    // 2. Parse and validate.
    let payload: RazorpayWebhookPayload;
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

    // 3. Idempotency check. If we've already seen this event id, drop it.
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (existing) {
      this.logger.warn(`Duplicate webhook received and ignored: ${eventId}`);
      return { status: 'IGNORED', reason: 'duplicate' };
    }

    // 4. Dispatch on event type. Only payment.captured / order.paid
    //    flip order state; everything else is recorded as SKIPPED.
    if (eventType !== 'order.paid' && eventType !== 'payment.captured') {
      await this.recordEvent(eventId, payload, WebhookEventStatus.SKIPPED);
      return { status: WebhookEventStatus.SKIPPED };
    }

    const razorpayOrderId =
      payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id;
    const razorpayPaymentId = payload.payload?.payment?.entity?.id;

    if (!razorpayOrderId || !razorpayPaymentId) {
      await this.recordEvent(eventId, payload, WebhookEventStatus.SKIPPED);
      return { status: WebhookEventStatus.SKIPPED };
    }

    return this.paymentsService.withPaymentLock(razorpayOrderId, async () => {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { razorpayOrderId },
          });

          if (!order) {
            await tx.webhookEvent.create({
              data: {
                id: eventId,
                status: WebhookEventStatus.SKIPPED,
                payload: payload as object,
              },
            });
            return {
              status: WebhookEventStatus.SKIPPED as WebhookEventStatus,
              cartToClear: null as { userId?: string; guestToken?: string } | null,
            };
          }

          // Use OrdersService.transitionStatus via a DB-side approach here
          // so the FOR UPDATE row lock on orders is held while we update.
          // We inline a minimal status flip rather than depending on the
          // OrdersService to avoid a circular module dependency.
          const orders = await tx.$queryRaw<
            Array<{
              id: string;
              status: OrderStatus;
              user_id: string | null;
              guest_token: string | null;
            }>
          >`SELECT id, status, user_id, guest_token FROM orders WHERE id = ${order.id} FOR UPDATE`;

          if (!orders.length) {
            throw new NotFoundException('Order disappeared during webhook processing');
          }
          const locked = orders[0];

          if (locked.status === OrderStatus.PAID) {
            await tx.webhookEvent.create({
              data: {
                id: eventId,
                status: WebhookEventStatus.SKIPPED,
                payload: payload as object,
              },
            });
            return {
              status: WebhookEventStatus.SKIPPED as WebhookEventStatus,
              cartToClear: null,
            };
          }

          await tx.order.update({
            where: { id: locked.id },
            data: {
              status: OrderStatus.PAID,
              razorpayPaymentId,
              paymentStatus: 'PAID',
              statusHistory: {
                create: {
                  oldStatus: locked.status,
                  newStatus: OrderStatus.PAID,
                  changedBy: 'WEBHOOK',
                  reason: `Payment captured via webhook: ${eventType}`,
                },
              },
            },
          });

          await tx.webhookEvent.create({
            data: {
              id: eventId,
              status: WebhookEventStatus.PROCESSED,
              payload: payload as object,
            },
          });

          return {
            status: WebhookEventStatus.PROCESSED as WebhookEventStatus,
            cartToClear: {
              userId: locked.user_id || undefined,
              guestToken: locked.guest_token || undefined,
            },
          };
        },
        { timeout: 8_000 },
      );

      // Clear the cart outside the transaction (cart service hits Redis
      // and S3 metadata; not transactional state).
      if (result.cartToClear) {
        const cart = result.cartToClear;
        await this.cartService.clearCart(cart.userId, cart.guestToken);
      }

      return { status: result.status };
    });
  }

  private async recordEvent(
    eventId: string,
    payload: unknown,
    status: WebhookEventStatus,
  ): Promise<void> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          id: eventId,
          status,
          payload: payload as object,
        },
      });
    } catch (e) {
      // P2002 unique-constraint = duplicate event id, which is fine.
      const code = (e as { code?: string }).code;
      if (code !== 'P2002') throw e;
    }
  }
}
