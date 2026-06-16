import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';

export function configureApp(app: INestApplication, configService: ConfigService) {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          frameSrc: ["'self'", 'https://checkout.razorpay.com'],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://*'],
          connectSrc: ["'self'", 'https://api.razorpay.com'],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );
  app.use(cookieParser());

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const frontendOrigins = configService.get<string>('FRONTEND_ORIGINS');
  const allowedOrigins = frontendOrigins ? frontendOrigins.split(',').map((o) => o.trim()) : [];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-cart-session-id, x-requested-with',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();
}
