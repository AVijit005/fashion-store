import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';
import { loggerConfig } from './config/logger.config';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';
import { configureApp } from './app.setup';

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  configureApp(app, configService);

  // Swagger API documentation — available in development/staging only.
  // In production, /docs returns 404 to avoid exposing internal API schemas.
  if (configService.get<string>('NODE_ENV') !== 'production') {
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
  const host = configService.get<string>('NODE_ENV') === 'production' ? '0.0.0.0' : '127.0.0.1';
  await app.listen(port, host);
  console.log(`🚀 Aura Streetwear Backend is running on: http://localhost:${port}`);
  if (configService.get<string>('NODE_ENV') !== 'production') {
    console.log(`📖 API Documentation available at: http://localhost:${port}/docs`);
  }
}
bootstrap();
