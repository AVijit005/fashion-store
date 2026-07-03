import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { Env } from './env.config';
import { buildDatabaseUrl } from './prisma.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService<Env>) {
    const finalUrl = buildDatabaseUrl(configService.get<string>('DATABASE_URL'));

    super(
      finalUrl
        ? {
            datasources: {
              db: {
                url: finalUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
