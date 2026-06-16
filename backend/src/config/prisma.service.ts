import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const rawUrl = process.env.DATABASE_URL;
    let finalUrl: string | undefined;
    
    if (rawUrl) {
      try {
        const url = new URL(rawUrl);
        url.searchParams.set('connection_limit', '20');
        url.searchParams.set('pool_timeout', '30');
        url.searchParams.set('statement_timeout', '15000');
        url.searchParams.set('lock_timeout', '5000');
        finalUrl = url.toString();
      } catch (e) {
        // ignore
      }
    }

    super(finalUrl ? {
      datasources: {
        db: {
          url: finalUrl,
        },
      },
    } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
    await this.setupSearchIndexes();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async setupSearchIndexes() {
    try {
      await this.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
      await this.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS products_title_trgm_idx ON products USING gin (title gin_trgm_ops);`,
      );
      await this.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS products_description_trgm_idx ON products USING gin (description gin_trgm_ops);`,
      );
      await this.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS products_tags_gin_idx ON products USING gin (tags);`,
      );
      this.logger.log('Database GIN and pg_trgm search indexes verified/created successfully.');
    } catch (err) {
      this.logger.error('Failed to set up PostgreSQL search indexes:', (err as Error).stack);
    }
  }
}
