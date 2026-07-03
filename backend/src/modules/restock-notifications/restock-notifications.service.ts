import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { restockNotificationTemplate } from '../email/templates/restock-notification';

/**
 * RestockNotificationsService — Phase 3 (audit item 3.1).
 *
 * Customers subscribe to be emailed when an out-of-stock variant comes
 * back. When inventory.restoreInventory bumps a variant from 0 to a
 * positive quantity, this service is invoked with the variant id; it
 * emails everyone with a pending (isNotified=false) subscription for
 * that variant and marks them notified.
 *
 * Subscriptions are anonymous (just an email) so we don't need auth —
 * the unique (variantId, email) constraint prevents spam signups.
 */
@Injectable()
export class RestockNotificationsService {
  private readonly logger = new Logger(RestockNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Anonymous subscribe. Idempotent — same email+variant returns the
   * existing subscription (with isNotified reset if the user wants to
   * be re-notified on the next stock event).
   */
  async subscribe(variantId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.restockNotification.upsert({
      where: { variantId_email: { variantId, email: normalizedEmail } },
      update: {
        // Re-subscribing after a previous notification: clear the flag so
        // the next restock event emails them again.
        isNotified: false,
        notifiedAt: null,
      },
      create: { variantId, email: normalizedEmail },
      select: { id: true, variantId: true, email: true, createdAt: true },
    });
  }

  /**
   * Pending subscriptions for a variant (haven't been notified yet).
   * Capped to 500 per variant to bound email blast size.
   */
  async findPendingByVariant(variantId: string) {
    return this.prisma.restockNotification.findMany({
      where: { variantId, isNotified: false },
      take: 500,
    });
  }

  /**
   * Triggered by InventoryService.restoreInventory when a variant's
   * stock goes from 0 to >0. Emails every pending subscriber and marks
   * them notified.
   */
  async triggerRestock(variantId: string): Promise<{ notified: number }> {
    const pending = await this.findPendingByVariant(variantId);
    if (pending.length === 0) return { notified: 0 };

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { title: true, slug: true } } },
    });
    if (!variant) return { notified: 0 };

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    const productUrl = `${frontendUrl}/p/${variant.product.slug}`;

    let notified = 0;
    for (const sub of pending) {
      try {
        const template = restockNotificationTemplate({
          productTitle: variant.product.title,
          size: variant.size,
          color: variant.color,
          productUrl,
        });
        await this.emailService.sendTemplate(sub.email, template);
        notified += 1;
      } catch (err) {
        this.logger.warn(
          `Restock email failed for ${sub.email} (variantId=${variantId}): ${(err as Error).message}`,
        );
      }
    }

    if (notified > 0) {
      await this.prisma.restockNotification.updateMany({
        where: { id: { in: pending.slice(0, notified).map((p) => p.id) } },
        data: { isNotified: true, notifiedAt: new Date() },
      });
    }

    this.logger.log(
      `Restock notifications: variantId=${variantId} pending=${pending.length} notified=${notified}`,
    );
    return { notified };
  }

  async listAll() {
    return this.prisma.restockNotification.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            product: { select: { id: true, title: true, slug: true } },
          },
        },
      },
      take: 500,
    });
  }

  async clearNotified(variantId: string) {
    const result = await this.prisma.restockNotification.updateMany({
      where: { variantId, isNotified: true },
      data: { isNotified: false, notifiedAt: null },
    });
    return { reset: result.count };
  }
}
