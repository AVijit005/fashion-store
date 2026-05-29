import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // Locks and reserves inventory for checkout
  async reserveInventory(
    items: { variantId: string; quantity: number; sku: string }[],
    tx: Prisma.TransactionClient,
  ) {
    const variantIds = items.map((item) => item.variantId);
    // Sort variant IDs to prevent deadlocks
    const sortedVariantIds = [...variantIds].sort();

    // Acquire locks on variant rows in sorted order
    await tx.$executeRawUnsafe(
      `SELECT id FROM product_variants WHERE id IN (${sortedVariantIds.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
      ...sortedVariantIds,
    );

    // Verify stock levels under lock
    const dbVariants = await tx.productVariant.findMany({
      where: { id: { in: sortedVariantIds } },
    });
    const dbVariantMap = new Map(dbVariants.map((v) => [v.id, v]));

    for (const item of items) {
      const variant = dbVariantMap.get(item.variantId);
      if (!variant || variant.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for SKU ${item.sku}. Available: ${variant?.stockQuantity || 0}, requested: ${item.quantity}`,
        );
      }
    }

    // Deduct Stock
    for (const item of items) {
      const variant = dbVariantMap.get(item.variantId);
      if (!variant) continue;
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          stockQuantity: variant.stockQuantity - item.quantity,
        },
      });
    }
  }

  // Locks and restores inventory for cancelled/failed order
  async restoreInventory(orderId: string, tx: Prisma.TransactionClient) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
    });

    if (items.length === 0) return;

    const variantIds = items
      .map((item) => item.productVariantId)
      .filter((id): id is string => id !== null);
    // Sort variant IDs to prevent deadlocks
    const sortedVariantIds = [...variantIds].sort();

    // Acquire locks on variant rows in sorted order
    await tx.$executeRawUnsafe(
      `SELECT id FROM product_variants WHERE id IN (${sortedVariantIds.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
      ...sortedVariantIds,
    );

    const dbVariants = await tx.productVariant.findMany({
      where: { id: { in: sortedVariantIds } },
    });
    const dbVariantMap = new Map(dbVariants.map((v) => [v.id, v]));

    for (const item of items) {
      if (!item.productVariantId) continue;
      const variant = dbVariantMap.get(item.productVariantId);
      if (variant) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stockQuantity: variant.stockQuantity + item.quantity,
          },
        });
      }
    }
  }
}
