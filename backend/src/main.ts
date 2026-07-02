import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';
import { createLoggerConfig } from './config/logger.config';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';
import { configureApp } from './app.setup';
import { Env } from './config/env.config';
import { scrubPii } from './common/sentry/sentry-pii-filter';

async function bootstrap() {
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

  configureApp(app, configService);

  // Swagger API documentation — available in development/staging only.
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
  console.log(`🚀 Aura Streetwear Backend is running on: http://localhost:${port}`);
  if (nodeEnv !== 'production') {
    console.log(`📖 API Documentation available at: http://localhost:${port}/docs`);
  }
}
bootstrap();
