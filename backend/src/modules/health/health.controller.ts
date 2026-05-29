import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get()
  async checkHealth() {
    let dbStatus = 'UP';
    let redisStatus = 'UP';
    const errors: string[] = [];

    // Test DB connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = 'DOWN';
      errors.push(`Database connection failed: ${(err as Error).message}`);
    }

    // Test Redis connection
    try {
      const ping = await this.redis.ping();
      if (ping !== 'PONG') {
        redisStatus = 'DOWN';
        errors.push(`Redis did not respond with PONG: ${ping}`);
      }
    } catch (err) {
      redisStatus = 'DOWN';
      errors.push(`Redis connection failed: ${(err as Error).message}`);
    }

    const isHealthy = dbStatus === 'UP' && redisStatus === 'UP';

    return {
      status: isHealthy ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
