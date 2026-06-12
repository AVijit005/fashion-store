import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredIdempotencyKeys() {
    this.logger.log('Starting cleanup of expired idempotency keys...');
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.log(`Deleted ${result.count} expired idempotency keys.`);
    } catch (error) {
      this.logger.error('Failed to cleanup idempotency keys', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    this.logger.log('Starting cleanup of expired sessions...');
    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.log(`Deleted ${result.count} expired sessions.`);
    } catch (error) {
      this.logger.error('Failed to cleanup sessions', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedS3Assets() {
    this.logger.log('Starting cleanup of orphaned S3 assets...');
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const orphanedAssets = await this.prisma.asset.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: twentyFourHoursAgo,
          },
        },
      });

      if (orphanedAssets.length === 0) {
        this.logger.log('No orphaned assets found.');
        return;
      }

      let deletedCount = 0;
      for (const asset of orphanedAssets) {
        try {
          await this.storageService.deleteObject(asset.storageKey);
          await this.prisma.asset.update({
            where: { id: asset.id },
            data: { status: 'DELETED' },
          });
          deletedCount++;
        } catch (err) {
          this.logger.error(`Failed to delete orphaned asset ${asset.id}`, err);
        }
      }

      this.logger.log(`Deleted ${deletedCount} orphaned assets from S3.`);
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned S3 assets', error);
    }
  }
}
