import { Module } from '@nestjs/common';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validateEnv } from './config/env.config';
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
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { CsrfGuard } from './common/guards/csrf.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 300 }],
        storage: new ThrottlerStorageRedisService(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
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
            tls: url.protocol === 'rediss:' ? { rejectUnauthorized: process.env.NODE_ENV === 'production' } : undefined,
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
    StorageModule,
    StudioModule,
    WishlistModule,
    AdminModule,
    MaintenanceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
