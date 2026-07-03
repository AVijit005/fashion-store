import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';
import { Env } from './config/env.config';
import { scrubPii } from './common/sentry/sentry-pii-filter';

/**
 * Worker process entry point.
 *
 * The worker process runs:
 *   - BullMQ consumers (OrderExpiryProcessor via `order-expiry` queue)
 *   - @Cron scheduled jobs (AbandonedCartCron, PaymentPendingReconciliationCron)
 *
 * It deliberately does NOT bind an HTTP port. The process stays alive
 * because BullMQ and @Cron keep the Node event loop busy; without them
 * the process would exit immediately.
 *
 * Run with RUN_WORKERS=true (this is what start:worker sets).
 */
async function bootstrapWorker() {
  if (process.env.RUN_WORKERS !== 'true') {
    console.error('FATAL: worker.ts requires RUN_WORKERS=true. Use main.ts for the API process.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  const configService = app.get<ConfigService<Env>>(ConfigService);
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const sentryDsn = configService.get<string>('SENTRY_DSN') || '';

  Sentry.init({
    dsn: sentryDsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
    profilesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend: scrubPii,
    beforeSendTransaction: scrubPii,
  });

  // Enable Nest shutdown hooks so SIGTERM triggers graceful cleanup of
  // BullMQ connections and cron jobs.
  app.enableShutdownHooks();

  console.log('👷 Worker process started. RUN_WORKERS=true.');
  console.log('   - BullMQ consumer: order-expiry');
  console.log('   - @Cron jobs: AbandonedCartCron, PaymentPendingReconciliationCron');

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down worker...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrapWorker().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
