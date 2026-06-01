import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { select: { productId: true } } },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
        include: { items: { select: { productId: true } } },
      });
    }

    return wishlist.items.map((item) => item.productId);
  }

  async toggleWishlistItem(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
      });
    }

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
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
      });
    }

    for (const productId of productIds) {
      const existingItem = await this.prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      });
      if (!existingItem) {
        const p = await this.prisma.product.findUnique({ where: { id: productId } });
        if (p) {
          await this.prisma.wishlistItem.create({
            data: { wishlistId: wishlist.id, productId },
          });
        }
      }
    }

    return this.getWishlist(userId);
  }
}
