import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
  register as defaultRegistry,
} from 'prom-client';

/**
 * MetricsService owns the application's Prometheus registry. It's a
 * process-global singleton so custom counters / histograms registered
 * here are visible to MetricsController regardless of which Nest
 * module owns the route.
 *
 * The default Node.js process metrics (CPU, memory, GC, event loop lag)
 * are auto-collected on the first call to `snapshot()`.
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  readonly ordersCreatedTotal: Counter<string>;
  readonly ordersPaidTotal: Counter<string>;
  readonly ordersRefundedTotal: Counter<string>;
  readonly orderExpiryProcessedTotal: Counter<string>;
  readonly paymentCircuitOpen: Gauge<string>;
  readonly paymentCircuitTripsTotal: Counter<string>;
  readonly cartRedisFallbackTotal: Counter<string>;
  readonly webhookProcessingSeconds: Histogram<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'aura-backend' });

    collectDefaultMetrics({ register: this.registry });

    this.ordersCreatedTotal = new Counter({
      name: 'aura_orders_created_total',
      help: 'Total number of orders created via the checkout endpoint',
      labelNames: ['payment_method'],
      registers: [this.registry],
    });

    this.ordersPaidTotal = new Counter({
      name: 'aura_orders_paid_total',
      help: 'Total number of orders that reached PAID status (Razorpay + COD)',
      labelNames: ['payment_provider'],
      registers: [this.registry],
    });

    this.ordersRefundedTotal = new Counter({
      name: 'aura_orders_refunded_total',
      help: 'Total number of orders refunded via the Razorpay refund API',
      labelNames: ['actor'],
      registers: [this.registry],
    });

    this.orderExpiryProcessedTotal = new Counter({
      name: 'aura_order_expiry_processed_total',
      help: 'Total number of payment-pending orders processed by the expiry worker',
      labelNames: ['outcome'],
      registers: [this.registry],
    });

    this.paymentCircuitOpen = new Gauge({
      name: 'aura_payment_circuit_open',
      help: '1 if the Razorpay circuit breaker is currently open, 0 if closed',
      registers: [this.registry],
    });

    this.paymentCircuitTripsTotal = new Counter({
      name: 'aura_payment_circuit_trips_total',
      help: 'Number of times the Razorpay circuit breaker has tripped open',
      registers: [this.registry],
    });

    this.cartRedisFallbackTotal = new Counter({
      name: 'aura_cart_redis_fallback_total',
      help: 'Number of cart reads that fell back from Redis to Postgres',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.webhookProcessingSeconds = new Histogram({
      name: 'aura_webhook_processing_seconds',
      help: 'End-to-end Razorpay webhook processing time',
      labelNames: ['event_type', 'outcome'],
      // Buckets tuned for typical webhook latency (10ms .. 5s)
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'aura_http_request_duration_seconds',
      help: 'HTTP request duration in seconds, labelled by method/route/status',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  /** Return the full registry snapshot in Prometheus exposition format. */
  async snapshot(): Promise<string> {
    return this.registry.metrics();
  }

  /** Reset every counter / histogram. Test-only. */
  reset(): void {
    this.registry.resetMetrics();
  }
}
