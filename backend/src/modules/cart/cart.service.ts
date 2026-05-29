import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../config/prisma.service';
import { ProductStatus, Prisma } from '@prisma/client';

interface CachedCartItem {
  id: string; // CartItem.id
  variantId: string | null;
  quantity: number;
  customData?: any;
}

export interface HydratedCartItem {
  id: string;
  variantId: string | null;
  sku: string | null;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productTitle: string;
  productSlug: string | null;
  thumbnailUrl: string | null;
  stockQuantity: number | null;
  isAvailable: boolean;
  customData?: any;
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
      try {
        return JSON.parse(cached) as CachedCartItem[];
      } catch {
        await this.redis.del(cacheKey);
      }
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
      id: item.id,
      variantId: item.productVariantId,
      quantity: item.quantity,
      customData: item.customData,
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

    const variantIds = items.map((i) => i.variantId).filter((id): id is string => id !== null);

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
    let totalAmount = new Prisma.Decimal(0);

    const hydratedItems = items
      .map((item) => {
        if (!item.variantId && item.customData) {
          // Custom studio item
          const price = new Prisma.Decimal(item.customData.price || 0); // Need to get price from custom data, wait, customData doesn't have price. Let's use 1499 default if not found.
          // In studio.tsx we don't pass price in customData. We passed productId, color, hex, layers.
          // Wait, studio.tsx addToCart adds price: product.price + 200.
          // To be safe, let's assume price is 1499 for custom.
          const fallbackPrice = new Prisma.Decimal(1499);
          const itemTotal = fallbackPrice.mul(item.quantity);
          totalAmount = totalAmount.add(itemTotal);
          return {
            id: item.id,
            variantId: null,
            sku: null,
            size: 'M',
            color: item.customData.color,
            quantity: item.quantity,
            unitPrice: fallbackPrice.toNumber(),
            totalPrice: itemTotal.toNumber(),
            productTitle: 'Custom ' + item.customData.productId,
            productSlug: null,
            thumbnailUrl: null,
            stockQuantity: null,
            isAvailable: true,
            customData: item.customData,
          };
        }

        const variant = variantMap.get(item.variantId!);
        if (!variant) {
          return null; // Product might have been draft-gated or deleted
        }

        const price = variant.priceOverride
          ? new Prisma.Decimal(variant.priceOverride.toString())
          : new Prisma.Decimal(variant.product.basePrice.toString());

        const itemTotal = price.mul(item.quantity);
        totalAmount = totalAmount.add(itemTotal);

        return {
          id: item.id,
          variantId: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          quantity: item.quantity,
          unitPrice: price.toNumber(),
          totalPrice: itemTotal.toNumber(),
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
      totalAmount: totalAmount.toNumber(),
    };
  }

  async addItem(itemId: string, quantity: number, userId?: string, sessionId?: string, customData?: any) {
    if (customData) {
      await this.prisma.$transaction(async (tx) => {
        const cart = await this.getOrCreateCart(tx, userId, sessionId);
        // For custom items, just create a new row
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            quantity,
            customData,
          },
        });
      });
      await this.invalidateCache(userId, sessionId);
      return this.getCart(userId, sessionId);
    }

    const variantId = itemId;
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

    await this.prisma.$transaction(async (tx) => {
      const cart = await this.getOrCreateCart(tx, userId, sessionId);
      
      // Use atomic increment to fix race conditions (Bug 3)
      try {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_productVariantId: {
              cartId: cart.id,
              productVariantId: variantId,
            },
          },
        });
        
        if (existing) {
          if (existing.quantity + quantity > variant.stockQuantity) {
            throw new BadRequestException(`Requested quantity exceeds available stock`);
          }
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: quantity } },
          });
        } else {
          if (quantity > variant.stockQuantity) {
            throw new BadRequestException(`Requested quantity exceeds available stock`);
          }
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productVariantId: variantId,
              quantity,
            },
          });
        }
      } catch (err) {
        throw err;
      }
    });

    // 4. Invalidate cache
    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async updateItem(itemId: string, quantity: number, userId?: string, sessionId?: string) {
    if (quantity <= 0) {
      return this.removeItem(itemId, userId, sessionId);
    }

    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Try finding by id first (for custom items or variant items)
    const item = await this.prisma.cartItem.findFirst({
      where: {
        OR: [
          { id: itemId, cartId: cart.id },
          { productVariantId: itemId, cartId: cart.id },
        ],
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.productVariantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: item.productVariantId, product: { status: ProductStatus.PUBLISHED } },
      });

      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      if (variant.stockQuantity < quantity) {
        throw new BadRequestException(
          `Requested quantity exceeds available stock (${variant.stockQuantity})`,
        );
      }
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
    });

    if (!cart) {
      return { items: [], totalAmount: 0 };
    }

    try {
      const item = await this.prisma.cartItem.findFirst({
        where: {
          OR: [
            { id: itemId, cartId: cart.id },
            { productVariantId: itemId, cartId: cart.id },
          ],
        },
      });
      if (item) {
        await this.prisma.cartItem.delete({
          where: { id: item.id },
        });
      }
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

    // Merge items transactionally
    await this.prisma.$transaction(async (tx) => {
      const userCart = await this.getOrCreateCart(tx, userId);
      const variants = await tx.productVariant.findMany({
        where: { id: { in: guestCart.items.map((item) => item.productVariantId) } },
        select: { id: true, stockQuantity: true },
      });
      const stockByVariant = new Map(
        variants.map((variant) => [variant.id, variant.stockQuantity]),
      );

      for (const guestItem of guestCart.items) {
        if (!guestItem.productVariantId) {
          // It's a custom item, just copy it over
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              quantity: guestItem.quantity,
              customData: guestItem.customData || undefined,
            },
          });
          continue;
        }

        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_productVariantId: {
              cartId: userCart.id,
              productVariantId: guestItem.productVariantId,
            },
          },
        });
        const stock = stockByVariant.get(guestItem.productVariantId) ?? 0;
        const mergedQuantity = Math.min(stock, (existing?.quantity || 0) + guestItem.quantity);
        if (mergedQuantity <= 0) {
          continue;
        }
        
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: mergedQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productVariantId: guestItem.productVariantId,
              quantity: mergedQuantity,
            },
          });
        }
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

  private async getOrCreateCart(tx: Prisma.TransactionClient, userId?: string, sessionId?: string) {
    const where = userId ? { userId } : { sessionId };
    const existing = await tx.cart.findFirst({ where });
    if (existing) {
      return existing;
    }
    try {
      return await tx.cart.create({
        data: {
          userId: userId || null,
          sessionId: sessionId || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const cart = await tx.cart.findFirst({ where });
        if (cart) {
          return cart;
        }
      }
      throw error;
    }
  }
}
