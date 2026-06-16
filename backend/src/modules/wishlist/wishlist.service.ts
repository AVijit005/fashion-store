import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const wishlist = await this.prisma.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { select: { productId: true } } },
    });

    return wishlist.items.map((item) => item.productId);
  }

  async toggleWishlistItem(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.prisma.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existingItem = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (existingItem) {
      await this.prisma.wishlistItem.delete({
        where: { id: existingItem.id },
      });
    } else {
      await this.prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });
    }

    return this.getWishlist(userId);
  }

  async syncWishlist(userId: string, productIds: string[]) {
    const wishlist = await this.prisma.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    // Prevent N+1 DoS: Batch query existing products and items
    const validProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const validProductIds = validProducts.map((p) => p.id);

    if (validProductIds.length === 0) {
      return this.getWishlist(userId);
    }

    const existingItems = await this.prisma.wishlistItem.findMany({
      where: {
        wishlistId: wishlist.id,
        productId: { in: validProductIds },
      },
      select: { productId: true },
    });

    const existingProductIds = new Set(existingItems.map((i) => i.productId));
    const itemsToCreate = validProductIds
      .filter((id) => !existingProductIds.has(id))
      .map((id) => ({ wishlistId: wishlist.id, productId: id }));

    if (itemsToCreate.length > 0) {
      await this.prisma.wishlistItem.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });
    }

    return this.getWishlist(userId);
  }
}
