import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssetStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { lowStockAlertTemplate } from '../email/templates/low-stock-alert';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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
          status: AssetStatus.PENDING,
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
            data: { status: AssetStatus.DELETED },
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

  /**
   * Phase 3 (audit item 3.1): daily low-stock scan.
   *
   * Finds every ProductVariant whose `stockQuantity` is at or below its
   * `lowStockThreshold` and emails the admin a digest via the
   * `low-stock-alert.ts` template. Runs at 8am IST-equivalent (02:30 UTC)
   * so the admin sees the digest before business hours.
   *
   * Skipped silently when:
   *   - no variants are below threshold
   *   - ADMIN_EMAIL is not configured (dev environments)
   */
  @Cron('30 2 * * *')
  async sendLowStockDigest() {
    this.logger.log('Starting low-stock scan...');
    try {
      const lowStockVariants = await this.prisma.productVariant.findMany({
        where: {
          isDeleted: false,
          product: { isDeleted: false, status: 'PUBLISHED' },
          stockQuantity: { lte: this.prisma.productVariant.fields.lowStockThreshold },
        },
        include: {
          product: { select: { title: true, slug: true } },
        },
        take: 200, // safety cap on a single digest
      });

      if (lowStockVariants.length === 0) {
        this.logger.log('No low-stock variants. Skipping email.');
        return;
      }

      const frontendUrl = (
        this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
      ).replace(/\/$/, '');
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL');

      const items = lowStockVariants.map((v) => ({
        sku: v.sku,
        name: `${v.product.title} (${v.size}/${v.color})`,
        stockQuantity: v.stockQuantity,
        threshold: v.lowStockThreshold,
        variantUrl: `${frontendUrl}/admin/products?focus=${encodeURIComponent(v.id)}`,
      }));

      if (!adminEmail) {
        this.logger.warn(
          `Skipping low-stock email: ADMIN_EMAIL not configured. ${items.length} variants below threshold.`,
        );
        return;
      }

      const template = lowStockAlertTemplate({
        items,
        adminProductsUrl: `${frontendUrl}/admin/products`,
      });
      await this.emailService.sendTemplate(adminEmail, template);
      this.logger.log(
        `Sent low-stock digest (${items.length} variants) to ${adminEmail}.`,
      );
    } catch (error) {
      this.logger.error('Failed to send low-stock digest', error);
    }
  }
}
