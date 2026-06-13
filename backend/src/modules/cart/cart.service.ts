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
  private readonly promiseMap = new Map<string, Promise<CachedCartItem[]>>();

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
    
    if (this.promiseMap.has(cacheKey)) {
      return this.promiseMap.get(cacheKey)!;
    }
    if (this.promiseMap.size > 5000) {
      throw new BadRequestException('Server is busy handling cart requests');
    }

    const promise = (async () => {
      let cached = null;

      try {
        cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as CachedCartItem[];
        }
      } catch (error) {
        console.warn(`Redis GET failed for ${cacheKey}`, error);
      }

      // Cache miss or Redis failure, load from DB
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

      try {
        await this.redis.set(cacheKey, JSON.stringify(items), 'EX', this.cacheTtl);
      } catch (error) {
        console.warn(`Redis SET failed for ${cacheKey}`, error);
      }
      return items;
    })().finally(() => {
      this.promiseMap.delete(cacheKey);
    });

    this.promiseMap.set(cacheKey, promise);
    return promise;
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

    const customProductIds = items
      .filter((i) => !i.variantId && i.customData?.productId)
      .map((i) => i.customData.productId as string);

    let customProductsMap = new Map();
    if (customProductIds.length > 0) {
      const customProducts = await this.prisma.product.findMany({
        where: { id: { in: customProductIds }, status: ProductStatus.PUBLISHED },
      });
      customProductsMap = new Map(customProducts.map(p => [p.id, p]));
    }

    let totalAmount = new Prisma.Decimal(0);

    const hydratedItems = items
      .map((item) => {
        if (!item.variantId && item.customData) {
          // Custom studio item
          const productId = item.customData.productId;
          const baseProduct = customProductsMap.get(productId);
          if (!baseProduct) return null; // Product deleted or draft-gated

          // Strictly compute price on backend: base price + 200 markup
          const basePrice = new Prisma.Decimal(baseProduct.basePrice.toString());
          const customPrice = basePrice.add(new Prisma.Decimal(200));
          const itemTotal = customPrice.mul(item.quantity);
          totalAmount = totalAmount.add(itemTotal);
          
          return {
            id: item.id,
            variantId: null,
            sku: null,
            size: item.customData.size || 'M',
            color: item.customData.color || '#000000',
            quantity: item.quantity,
            unitPrice: customPrice.toNumber(),
            totalPrice: itemTotal.toNumber(),
            productTitle: `Custom ${baseProduct.title}`,
            productSlug: baseProduct.slug,
            thumbnailUrl: baseProduct.mediaUrls?.[0] || null,
            stockQuantity: null,
            isAvailable: true,
            customData: item.customData,
          } as HydratedCartItem;
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
        } as HydratedCartItem;
      })
      .filter((item): item is HydratedCartItem => item !== null);

    return {
      items: hydratedItems,
      totalAmount: totalAmount.toNumber(),
    };
  }

  async addItem(itemId: string, quantity: number, userId?: string, sessionId?: string, customData?: any) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
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
      
      // Use atomic SQL to fix TOCTOU race conditions (Bug 1 Audit)
      const updatedCount = await tx.$executeRawUnsafe(
        `
        INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, updated_at)
        SELECT gen_random_uuid(), $1, $2, $3, NOW()
        WHERE $3 <= (SELECT stock_quantity FROM product_variants WHERE id = $2)
        ON CONFLICT (cart_id, product_variant_id) DO UPDATE
        SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
        WHERE cart_items.quantity + EXCLUDED.quantity <= (SELECT stock_quantity FROM product_variants WHERE id = EXCLUDED.product_variant_id)
        `,
        cart.id,
        variantId,
        quantity,
      );

      if (updatedCount === 0) {
        throw new BadRequestException('Requested quantity exceeds available stock');
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
      const updatedCount = await this.prisma.$executeRawUnsafe(
        `
        UPDATE cart_items
        SET quantity = $1, updated_at = NOW()
        WHERE id = $2
        AND $1 <= (SELECT stock_quantity FROM product_variants WHERE id = $3)
        `,
        quantity,
        item.id,
        item.productVariantId,
      );

      if (updatedCount === 0) {
        throw new BadRequestException('Requested quantity exceeds available stock');
      }
    } else {
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }

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
    } catch (error) {
      console.error(`Failed to remove item ${itemId} from cart`, error);
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
        where: { id: { in: guestCart.items.map((item) => item.productVariantId).filter((id): id is string => id !== null) } },
        select: { id: true, stockQuantity: true },
      });
      const stockByVariant = new Map(
        variants.map((variant) => [variant.id, variant.stockQuantity]),
      );

      const existingUserItems = await tx.cartItem.findMany({
        where: { cartId: userCart.id },
      });
      const existingUserItemMap = new Map(existingUserItems.map(i => [i.productVariantId, i]));

      const mergePromises = guestCart.items.map((guestItem) => {
        if (!guestItem.productVariantId) {
          return tx.cartItem.create({
            data: {
              cartId: userCart.id,
              quantity: guestItem.quantity,
              customData: guestItem.customData || undefined,
            },
          });
        }

        const existing = existingUserItemMap.get(guestItem.productVariantId);
        const stock = stockByVariant.get(guestItem.productVariantId) ?? 0;
        const mergedQuantity = Math.min(stock, (existing?.quantity || 0) + guestItem.quantity);
        if (mergedQuantity <= 0) {
          return Promise.resolve();
        }
        
        if (existing) {
          return tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: mergedQuantity },
          });
        } else {
          return tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productVariantId: guestItem.productVariantId,
              quantity: mergedQuantity,
            },
          });
        }
      });
      await Promise.all(mergePromises);

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
    try {
      const cacheKey = this.getCacheKey(userId, sessionId);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.warn(`Redis DEL failed for cacheKey: ${userId || sessionId}`, error);
    }
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
