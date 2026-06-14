import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';

export function configureApp(app: INestApplication, configService: ConfigService) {
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const frontendOrigins = configService.get<string>('FRONTEND_ORIGINS');
  app.enableCors({
    origin: frontendOrigins ? frontendOrigins.split(',') : true,
    credentials: true,
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
