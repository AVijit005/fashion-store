import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createLoggerConfig } from './config/logger.config';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';
import { configureApp } from './app.setup';
import { Env } from './config/env.config';
import { scrubPii } from './common/sentry/sentry-pii-filter';

async function bootstrap() {
  // API replica: RUN_WORKERS must NOT be true here (defense in depth \u2014
  // the dynamic WorkerModule.forRoot({ enabled: false }) prevents worker
  // classes from being instantiated regardless, but failing fast with a
  // clear error message is friendlier than a silent misconfiguration).
  if (process.env.RUN_WORKERS === 'true') {
    console.error(
      'FATAL: main.ts (API process) was started with RUN_WORKERS=true. Use worker.ts for the worker process.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configService = app.get<ConfigService<Env>>(ConfigService);
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const sentryDsn = configService.get<string>('SENTRY_DSN') || '';

  Sentry.init({
    dsn: sentryDsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
    profilesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
    // Never send PII to Sentry by default. The scrubPii beforeSend hook
    // also strips any PII that slips through (auth headers, cookies,
    // passwords, emails, IPs, tokens in query strings).
    sendDefaultPii: false,
    beforeSend: scrubPii,
    beforeSendTransaction: scrubPii,
  });

  app.useLogger(WinstonModule.createLogger(createLoggerConfig(configService)));

  // Phase 5 (audit item 5.4): Helmet with a strict CSP + standard
  // hardening headers. Applied BEFORE any route handler so all responses
  // (including errors and CORS preflights) carry them.
  //
  // CSP is deliberately relaxed for /docs (Swagger UI) so the interactive
  // API console can load its own scripts/styles.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          // Razorpay inline-checkout.js + Sentry inline-script + Stripe.js
          // are the only third-party scripts we load.
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://checkout.razorpay.com',
            'https://js.stripe.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://*.sentry.io'],
          frameSrc: ['https://checkout.razorpay.com', 'https://js.stripe.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: nodeEnv === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // Allows Stripe iframe + Razorpay
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Sentry beacon + images
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: {
        maxAge: 63_072_000, // 2 years in seconds
        includeSubDomains: true,
        preload: nodeEnv === 'production',
      },
      xContentTypeOptions: true,          // nosniff
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,             // IE no-open
      xFrameOptions: { action: 'deny' },  // clickjacking
      xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
      xPoweredBy: false,                   // remove X-Powered-By: Express
    }),
  );

  configureApp(app, configService);

  // Swagger API documentation \u2014 available in development/staging only.
  // In production, /docs returns 404 to avoid exposing internal API schemas.
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aura Streetwear API')
      .setDescription('Premium streetwear e-commerce platform backend API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  const host = nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1';
  await app.listen(port, host);
  console.log(`\ud83d\ude80 Aura Streetwear Backend is running on: http://localhost:${port}`);
  if (nodeEnv !== 'production') {
    console.log(`\ud83d\udcd6 API Documentation available at: http://localhost:${port}/docs`);
  }
}
bootstrap();
