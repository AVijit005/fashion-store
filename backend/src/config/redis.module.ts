import { Module, Global, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const clusterNodesStr = configService.get<string>('REDIS_CLUSTER_NODES');
        if (!redisUrl && !clusterNodesStr) {
          throw new Error('REDIS_URL or REDIS_CLUSTER_NODES config is missing');
        }

        const isTls = redisUrl?.startsWith('rediss://');

        const commonConfig = {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          ...(isTls && { tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' } }),
        };

        if (clusterNodesStr) {
          const nodes = clusterNodesStr.split(',').map((node) => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port, 10) };
          });
          return new Redis.Cluster(nodes, { redisOptions: commonConfig });
        }

        return new Redis(redisUrl as string, commonConfig);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
