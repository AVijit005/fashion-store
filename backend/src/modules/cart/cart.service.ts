import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../config/prisma.service';
import { ProductStatus } from '@prisma/client';

interface CachedCartItem {
  variantId: string;
  quantity: number;
}

export interface HydratedCartItem {
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productTitle: string;
  productSlug: string;
  thumbnailUrl: string | null;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface HydratedCart {
  items: HydratedCartItem[];
  totalAmount: number;
}

@Injectable()
export class CartService {
  private readonly redisPrefix = 'cart:';
  private readonly cacheTtl = 1209600; // 14 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private getCacheKey(userId?: string, sessionId?: string): string {
    if (userId) {
      return `${this.redisPrefix}u:${userId}`;
    }
    if (sessionId) {
      return `${this.redisPrefix}s:${sessionId}`;
    }
    throw new BadRequestException(
      'Either userId or sessionId must be provided for cart operations',
    );
  }

  // Retrieve minimal cached array of variant IDs and quantities
  async getCartItems(userId?: string, sessionId?: string): Promise<CachedCartItem[]> {
    const cacheKey = this.getCacheKey(userId, sessionId);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as CachedCartItem[];
    }

    // Cache miss, load from DB
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: true,
      },
    });

    if (!cart) {
      return [];
    }

    const items: CachedCartItem[] = cart.items.map((item) => ({
      variantId: item.productVariantId,
      quantity: item.quantity,
    }));

    await this.redis.set(cacheKey, JSON.stringify(items), 'EX', this.cacheTtl);
    return items;
  }

  // Retrieve fully hydrated cart with live prices and stock availability
  async getCart(userId?: string, sessionId?: string): Promise<HydratedCart> {
    const items = await this.getCartItems(userId, sessionId);
    if (items.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    const variantIds = items.map((i) => i.variantId);

    // Fetch live product data, ensuring we always return correct/fresh pricing and stock
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        product: {
          status: ProductStatus.PUBLISHED,
        },
      },
      include: {
        product: true,
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    let totalAmount = 0;

    const hydratedItems = items
      .map((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          return null; // Product might have been draft-gated or deleted
        }

        const price = variant.priceOverride
          ? Number(variant.priceOverride)
          : Number(variant.product.basePrice);
        const itemTotal = price * item.quantity;
        totalAmount += itemTotal;

        return {
          variantId: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          quantity: item.quantity,
          unitPrice: price,
          totalPrice: itemTotal,
          productTitle: variant.product.title,
          productSlug: variant.product.slug,
          thumbnailUrl: variant.thumbnailUrl || variant.mediaUrls[0] || null,
          stockQuantity: variant.stockQuantity,
          isAvailable: variant.stockQuantity >= item.quantity,
        };
      })
      .filter((item): item is HydratedCartItem => item !== null);

    return {
      items: hydratedItems,
      totalAmount,
    };
  }

  async addItem(variantId: string, quantity: number, userId?: string, sessionId?: string) {
    // 1. Verify variant exists and parent product is published
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: {
          status: ProductStatus.PUBLISHED,
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found or unavailable');
    }

    if (variant.stockQuantity <= 0) {
      throw new BadRequestException('Product variant is out of stock');
    }

    // 2. Find or create Cart in DB
    let cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId: userId || null,
          sessionId: sessionId || null,
        },
      });
    }

    // 3. Upsert CartItem
    await this.prisma.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: variantId,
        },
      },
      create: {
        cartId: cart.id,
        productVariantId: variantId,
        quantity,
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
    });

    // 4. Invalidate cache
    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async updateItem(variantId: string, quantity: number, userId?: string, sessionId?: string) {
    if (quantity <= 0) {
      return this.removeItem(variantId, userId, sessionId);
    }

    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Check if variant has sufficient stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    if (variant.stockQuantity < quantity) {
      throw new BadRequestException(
        `Requested quantity exceeds available stock (${variant.stockQuantity})`,
      );
    }

    await this.prisma.cartItem.update({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: variantId,
        },
      },
      data: { quantity },
    });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async removeItem(variantId: string, userId?: string, sessionId?: string) {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (!cart) {
      return { items: [], totalAmount: 0 };
    }

    try {
      await this.prisma.cartItem.delete({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId: variantId,
          },
        },
      });
    } catch {
      // Item might not exist, ignore
    }

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    await this.invalidateCache(userId, sessionId);
    return { items: [], totalAmount: 0 };
  }

  async mergeCart(guestSessionId: string, userId: string) {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId: guestSessionId },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId);
    }

    let userCart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!userCart) {
      userCart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // Merge items transactionally
    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        await tx.cartItem.upsert({
          where: {
            cartId_productVariantId: {
              cartId: userCart.id,
              productVariantId: guestItem.productVariantId,
            },
          },
          create: {
            cartId: userCart.id,
            productVariantId: guestItem.productVariantId,
            quantity: guestItem.quantity,
          },
          update: {
            quantity: {
              increment: guestItem.quantity,
            },
          },
        });
      }

      // Delete the guest cart items
      await tx.cartItem.deleteMany({
        where: { cartId: guestCart.id },
      });

      // Delete the guest cart itself
      await tx.cart.delete({
        where: { id: guestCart.id },
      });
    });

    // Invalidate caches
    await this.invalidateCache(undefined, guestSessionId);
    await this.invalidateCache(userId, undefined);

    return this.getCart(userId);
  }

  private async invalidateCache(userId?: string, sessionId?: string) {
    const cacheKey = this.getCacheKey(userId, sessionId);
    await this.redis.del(cacheKey);
  }
}
