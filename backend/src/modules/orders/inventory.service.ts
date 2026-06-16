import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // Locks and reserves inventory for checkout
  async reserveInventory(
    items: { variantId: string; quantity: number; sku?: string }[],
    tx: Prisma.TransactionClient,
    force: boolean = false,
  ) {
    const qtyByVariant = new Map<string, number>();
    for (const item of items) {
      qtyByVariant.set(
        item.variantId,
        (qtyByVariant.get(item.variantId) || 0) + item.quantity,
      );
    }
    const sortedVariantIds = Array.from(qtyByVariant.keys()).sort();
    if (sortedVariantIds.length === 0) return;

    // Acquire locks on variant rows in sorted order
    await tx.$executeRawUnsafe(
      `SELECT id FROM product_variants WHERE id IN (${sortedVariantIds.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY id FOR UPDATE`,
      ...sortedVariantIds,
    );

    // Verify stock levels under lock
    const dbVariants = await tx.productVariant.findMany({
      where: { id: { in: sortedVariantIds } },
    });
    const dbVariantMap = new Map(dbVariants.map((v) => [v.id, v]));

    for (const [variantId, quantity] of qtyByVariant.entries()) {
      const variant = dbVariantMap.get(variantId);
      if (!variant) {
        throw new BadRequestException(`Variant ${variantId} not found`);
      }
      if (variant.stockQuantity < quantity) {
        throw new BadRequestException(
          `Insufficient stock for SKU ${variant.sku || variantId}. Available: ${variant.stockQuantity}, requested: ${quantity}`,
        );
      }
    }

    // Deduct Stock
    for (const variantId of sortedVariantIds) {
      const quantityToDeduct = qtyByVariant.get(variantId) || 0;
      if (quantityToDeduct === 0) continue;

        const updateResult = await tx.productVariant.updateMany({
          where: {
            id: variantId,
            stockQuantity: { gte: quantityToDeduct },
          },
          data: {
            stockQuantity: { decrement: quantityToDeduct },
          },
        });
        
        if (updateResult.count === 0) {
          throw new BadRequestException(
            `Failed to deduct stock securely for variant ${variantId}. Overselling detected.`,
          );
        }
    }
  }

  // Locks and restores inventory for cancelled/failed order
  async restoreInventory(orderId: string, tx: Prisma.TransactionClient) {
    await this.restoreBulkInventory([orderId], tx);
  }

  async restoreBulkInventory(orderIds: string[], tx: Prisma.TransactionClient) {
    if (orderIds.length === 0) return;
    const items = await tx.orderItem.findMany({
      where: { orderId: { in: orderIds } },
    });

    if (items.length === 0) return;

    const qtyByVariant = new Map<string, number>();
    for (const item of items) {
      if (!item.productVariantId) continue;
      qtyByVariant.set(
        item.productVariantId,
        (qtyByVariant.get(item.productVariantId) || 0) + item.quantity,
      );
    }

    const variantIds = Array.from(qtyByVariant.keys()).sort();
    if (variantIds.length === 0) return;

    // Acquire locks on variant rows in sorted order
    await tx.$executeRawUnsafe(
      `SELECT id FROM product_variants WHERE id IN (${variantIds.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY id FOR UPDATE`,
      ...variantIds,
    );

    for (const vid of variantIds) {
      const qty = qtyByVariant.get(vid);
      if (!qty) continue;
      await tx.productVariant.update({
        where: { id: vid },
        data: { stockQuantity: { increment: qty } },
      });
    }
  }
}
