import type { OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(redisUrl: string, isProduction: boolean) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      ...(redisUrl.startsWith('rediss://') && {
        tls: {
          rejectUnauthorized: isProduction,
        },
      }),
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const storageKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;

    const [totalHits, ttlMs, blocked, blockTtlMs] = (await this.redis.eval(
      `
      local blockTtl = redis.call("PTTL", KEYS[2])
      if blockTtl > 0 then
        local current = redis.call("GET", KEYS[1]) or ARGV[3]
        return { tonumber(current), redis.call("PTTL", KEYS[1]), 1, blockTtl }
      end

      local hits = redis.call("INCR", KEYS[1])
      if hits == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end

      local ttl = redis.call("PTTL", KEYS[1])
      if hits > tonumber(ARGV[3]) then
        redis.call("SET", KEYS[2], "1", "PX", ARGV[2])
        return { hits, ttl, 1, tonumber(ARGV[2]) }
      end

      return { hits, ttl, 0, 0 }
      `,
      2,
      storageKey,
      blockKey,
      Math.max(ttl, 1).toString(),
      Math.max(blockDuration || ttl, 1).toString(),
      limit.toString(),
    )) as [number, number, number, number];

    return {
      totalHits: Number(totalHits),
      timeToExpire: Math.max(Math.ceil(Number(ttlMs) / 1000), 0),
      isBlocked: Number(blocked) === 1,
      timeToBlockExpire: Math.max(Math.ceil(Number(blockTtlMs) / 1000), 0),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
