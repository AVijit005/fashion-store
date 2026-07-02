import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import Redis from 'ioredis';

const LOCK_RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface CreateGatewayOrderInput {
  amountInPaise: number;
  receipt: string;
  /** Caller's idempotency key. Razorpay's own Idempotency-Key header value. */
  idempotencyKey: string;
}

export interface CreateGatewayOrderResult {
  razorpayOrderId: string;
}

/**
 * PaymentsService owns every interaction with the Razorpay gateway:
 *   - creating gateway orders
 *   - verifying payment signatures
 *   - processing refunds
 *   - serializing concurrent payment verification via a Redis lock with
 *     a Lua-atomic release
 *
 * It deliberately knows nothing about the orders domain; OrdersService
 * hands the gateway the order id as a receipt and asks PaymentsService
 * to flip the order to PAID once the gateway confirms.
 *
 * Extracted from OrdersService in Phase 2 to keep the 800-line god
 * object under control. The original method names are preserved where
 * possible so the diff stays reviewable.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // In-memory circuit breaker for the Razorpay HTTP API.
  // NOTE: per-pod (see H-B12). Acceptable until we move to Redis-backed;
  // the breaker is best-effort protection against a gateway outage
  // cascading into a queue-full of retry jobs.
  private razorpayFailures = 0;
  private razorpayCircuitOpenUntil = 0;
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_OPEN_MS = 60_000;
  private readonly RAZORPAY_HTTP_TIMEOUT_MS = 5_000;
  private readonly RAZORPAY_HTTP_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  // ---------- Lock ----------

  /**
   * Distributed lock keyed on the Razorpay order id. The release uses
   * a Lua script so we never accidentally release a lock that has
   * expired and been re-acquired by another process.
   */
  async withPaymentLock<T>(
    razorpayOrderId: string,
    fn: () => Promise<T>,
    timeoutMs = 5_000,
  ): Promise<T> {
    const lockKey = `payment:verify:${razorpayOrderId}`;
    const token = crypto.randomUUID();
    const ok = await this.redisClient.set(lockKey, token, 'PX', timeoutMs, 'NX');
    if (!ok) {
      throw new ConflictException('Payment verification already in progress.');
    }
    try {
      return await fn();
    } finally {
      try {
        await this.redisClient.eval(LOCK_RELEASE_LUA, 1, lockKey, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Failed to release payment lock ${lockKey}: ${msg}`);
      }
    }
  }

  // ---------- Signature verification ----------

  /**
   * Verifies the HMAC-SHA256 signature Razorpay returns to the client.
   * Uses a timing-safe compare; throws BadRequest on any mismatch.
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): void {
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    let expectedBuffer: Buffer;
    let actualBuffer: Buffer;
    try {
      expectedBuffer = Buffer.from(expectedSignature, 'hex');
      actualBuffer = Buffer.from(razorpaySignature, 'hex');
    } catch {
      throw new BadRequestException('Malformed signature encoding');
    }

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new BadRequestException('Invalid signature verification');
    }
  }

  /**
   * Verifies the webhook signature (separate secret from the API key).
   */
  verifyWebhookSignature(rawBody: string, signature: string): void {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    if (!webhookSecret) {
      throw new InternalServerErrorException('Webhook secret is not configured');
    }
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Invalid or missing webhook signature');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

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
  }

  // ---------- Gateway order creation ----------

  /**
   * Calls Razorpay to create a payment order. Honours the circuit breaker
   * and retries 5xx / network errors with backoff. Returns a deterministic
   * mock id (`rzp_mock_…`) when the configured keys are mock values so
   * the dev / CI environment can flow through checkout end-to-end.
   */
  async createGatewayOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult> {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';

    // Mock path — no real Razorpay call.
    if (keyId.startsWith('mock') || !keyId || !keySecret) {
      return {
        razorpayOrderId: `rzp_mock_${crypto.randomUUID().replace(/-/g, '')}`,
      };
    }

    if (!/^rzp_(test|live)_/.test(keyId) || keySecret.length < 8) {
      throw new InternalServerErrorException('Payment gateway is not configured');
    }

    if (Date.now() < this.razorpayCircuitOpenUntil) {
      throw new Error('Circuit breaker open. Payment gateway is temporarily unavailable.');
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const idempotencyKeyReq = `req_${input.idempotencyKey}`;

    let response: Response | undefined;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.RAZORPAY_HTTP_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.RAZORPAY_HTTP_TIMEOUT_MS);
      try {
        response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyReq,
          },
          body: JSON.stringify({
            amount: input.amountInPaise,
            currency: 'INR',
            receipt: input.receipt,
          }),
          signal: controller.signal,
        });
        if (response.ok) {
          this.razorpayFailures = 0;
        } else if (response.status >= 500) {
          throw new Error(`Gateway Error: ${response.status}`);
        }
        break;
      } catch (e) {
        lastErr = e;
        const isCountableFailure =
          !response ||
          response.status >= 500 ||
          (e instanceof Error && e.name === 'AbortError');
        if (isCountableFailure) {
          this.razorpayFailures += 1;
          if (this.razorpayFailures >= this.CIRCUIT_FAILURE_THRESHOLD) {
            this.razorpayCircuitOpenUntil = Date.now() + this.CIRCUIT_OPEN_MS;
            this.razorpayFailures = 0;
          }
        }
        if (attempt === this.RAZORPAY_HTTP_ATTEMPTS) throw e;
        await new Promise((res) => setTimeout(res, attempt * 1000));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!response || !response.ok) {
      const errBody = response ? await response.text() : String(lastErr);
      throw new Error(`Razorpay API error: ${errBody}`);
    }

    const data = (await response.json()) as { id: string };
    return { razorpayOrderId: data.id };
  }

  // ---------- Refunds ----------

  /**
   * Calls Razorpay to issue a refund for a previously captured payment.
   * Caller is responsible for flipping the order to REFUNDED inside the
   * same transaction that calls this; we do not mutate order state here.
   */
  async refundPayment(paymentId: string, amountInPaise: number): Promise<void> {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';

    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay keys not configured. Skipping refund API call.');
      return;
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify({ amount: Math.round(amountInPaise) }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Razorpay refund API error: ${errBody}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process Razorpay refund: ${msg}`);
      throw error;
    }
  }

  // ---------- Order state mutations ----------

  /**
   * Marks an order as PAID inside the supplied transaction. Idempotent
   * — calling on an already-PAID order returns the existing row with
   * cartToClear=null so the caller can skip cart cleanup.
   *
   * Extracted from OrdersService; the signature is unchanged so existing
   * callers continue to work.
   */
  async markOrderPaid(
    tx: Prisma.TransactionClient,
    order: { id: string; status: OrderStatus; userId: string | null; guestToken: string | null },
    razorpayPaymentId: string,
    _actor: 'USER' | 'WEBHOOK',
    _note: string,
    razorpaySignature?: string,
  ): Promise<{
    orderId: string;
    status: OrderStatus;
    order: typeof order;
    cartToClear: { userId?: string; guestToken?: string } | null;
  }> {
    if (order.status === OrderStatus.PAID) {
      return {
        orderId: order.id,
        status: order.status,
        order,
        cartToClear: null,
      };
    }

    // Caller is responsible for transitioning the status (it needs to be
    // done inside the same tx with the FOR UPDATE lock acquired by the
    // caller's transactionStatus call).
    const updateData: Prisma.OrderUpdateInput = {
      razorpayPaymentId,
      paymentStatus: PaymentStatus.PAID,
    };
    if (razorpaySignature) {
      updateData.razorpaySignature = razorpaySignature;
    }

    await tx.order.update({
      where: { id: order.id },
      data: updateData,
    });

    return {
      orderId: order.id,
      status: OrderStatus.PAID,
      order,
      cartToClear: {
        userId: order.userId || undefined,
        guestToken: order.guestToken || undefined,
      },
    };
  }
}
