import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loggerConfig } from './config/logger.config';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin:
      configService.get<string>('NODE_ENV') === 'production'
        ? ['https://aurastreetwear.com']
        : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aura Streetwear API')
    .setDescription('Premium streetwear e-commerce platform backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`🚀 Aura Streetwear Backend is running on: http://localhost:${port}`);
  console.log(`📖 API Documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
