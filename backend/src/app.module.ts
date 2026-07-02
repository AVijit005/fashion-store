import { Module } from '@nestjs/common';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validateEnv, Env } from './config/env.config';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './config/prisma.module';
import { RedisModule } from './config/redis.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminModule } from './modules/admin/admin.module';
import { ScheduleModule } from '@nestjs/schedule';
import { StorageModule } from './modules/storage/storage.module';
import { StudioModule } from './modules/studio/studio.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { CsrfGuard } from './common/guards/csrf.guard';
import { CsrfService } from './common/guards/csrf.service';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { WorkerModule } from './modules/worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) => {
        const clusterNodesStr = configService.get<string>('REDIS_CLUSTER_NODES');
        if (clusterNodesStr) {
          const nodes = clusterNodesStr.split(',').map((node) => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port, 10) };
          });
          const Redis = require('ioredis');
          return { connection: new Redis.Cluster(nodes) };
        }

        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL or REDIS_CLUSTER_NODES config is missing');
        }
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? { rejectUnauthorized: configService.get('NODE_ENV', 'development') === 'production' } : undefined,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    WebhooksModule,
    NewsletterModule,
    StorageModule,
    StudioModule,
    WishlistModule,
    AdminModule,
    MaintenanceModule,
    // Phase 6: conditionally enable BullMQ processors + @Cron jobs.
    // API replica runs with RUN_WORKERS unset/false (worker classes
    // are not provided, no @Processor subscribes to a queue, no @Cron
    // schedule is registered). Worker replica runs with RUN_WORKERS=true.
    WorkerModule.forRoot({
      enabled: process.env.RUN_WORKERS === 'true',
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    CsrfService,
  ],
})
export class AppModule {}
