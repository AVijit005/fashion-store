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
    force: boolean = false
  ) {
    const variantIds = items.map((item) => item.variantId);
    if (variantIds.length === 0) return;
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
      if (!variant) {
        throw new BadRequestException(`Variant ${item.variantId} not found`);
      }
      if (!force && variant.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for SKU ${item.sku || item.variantId}. Available: ${variant.stockQuantity}, requested: ${item.quantity}`,
        );
      }
    }

    // Deduct Stock
    await Promise.all(
      items.map((item) => {
        const variant = dbVariantMap.get(item.variantId);
        if (!variant) return Promise.resolve();
        return tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
      })
    );
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
        (qtyByVariant.get(item.productVariantId) || 0) + item.quantity
      );
    }

    const variantIds = Array.from(qtyByVariant.keys()).sort();
    if (variantIds.length === 0) return;

    // Acquire locks on variant rows in sorted order
    await tx.$executeRawUnsafe(
      `SELECT id FROM product_variants WHERE id IN (${variantIds.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
      ...variantIds,
    );

    await Promise.all(
      variantIds.map((vid) =>
        tx.productVariant.update({
          where: { id: vid },
          data: {
            stockQuantity: { increment: qtyByVariant.get(vid) },
          },
        })
      )
    );
  }
}
