import {
  Injectable,
  BadRequestException,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { SettingsService } from '../../config/settings.service';
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
    private readonly settingsService: SettingsService,
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

    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss: attempt to acquire lock to populate cache, with retry.
    const lockKey = `${cacheKey}:lock`;
    let lockAcquired: string | null = null;
    let redisDown = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        lockAcquired = await this.redis.set(lockKey, 'locked', 'EX', 10, 'NX');
        if (lockAcquired) {
          break;
        }
      } catch (error) {
        console.warn(`Redis lock acquisition failed for ${cacheKey}`, error);
        redisDown = true;
        break;
      }

      // Lock is busy: another request is populating the cache. Wait briefly
      // and re-read the cache before the next attempt.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const retryCache = await this.readCache(cacheKey);
      if (retryCache) {
        return retryCache;
      }
    }

    // If Redis is unavailable or the lock remained busy, fall back to a direct
    // DB read. Cart reads must never fail with a 503.
    if (!lockAcquired) {
      return this.loadCartItemsFromDb(userId, sessionId);
    }

    try {
      // Re-check cache in case another pod just populated it
      const recheck = await this.readCache(cacheKey);
      if (recheck) {
        return recheck;
      }

      const items = await this.loadCartItemsFromDb(userId, sessionId);

      try {
        await this.redis.set(cacheKey, JSON.stringify(items), 'EX', this.cacheTtl);
      } catch (error) {
        console.warn(`Redis SET failed for ${cacheKey}`, error);
      }

      return items;
    } finally {
      await this.redis.del(lockKey).catch(() => null);
    }
  }

  private async readCache(cacheKey: string): Promise<CachedCartItem[] | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CachedCartItem[];
      }
    } catch (error) {
      console.warn(`Redis GET failed for ${cacheKey}`, error);
    }
    return null;
  }

  private async loadCartItemsFromDb(
    userId?: string,
    sessionId?: string,
  ): Promise<CachedCartItem[]> {
    const cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: { items: true },
    });

    if (!cart) {
      return [];
    }

    return cart.items.map((item) => ({
      id: item.id,
      variantId: item.productVariantId,
      quantity: item.quantity,
      customData: item.customData,
    }));
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
        isDeleted: false,
        product: {
          status: ProductStatus.PUBLISHED,
          isDeleted: false,
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
      customProductsMap = new Map(customProducts.map((p) => [p.id, p]));
    }

    let totalAmount = new Prisma.Decimal(0);

    const settings = await this.settingsService.getAll();

    const hydratedItems = items
      .map((item) => {
        if (!item.variantId && item.customData) {
          // Custom studio item
          const productId = item.customData.productId;
          const baseProduct = customProductsMap.get(productId);
          if (!baseProduct) return null; // Product deleted or draft-gated

          // Phase 1 (audit item 1.7): custom-print markup is configurable via
          // GlobalSettings (key: `studio.customPrintMarkup`). Default 200.
          const basePrice = new Prisma.Decimal(baseProduct.basePrice.toString());
          const customPrice = basePrice.add(new Prisma.Decimal(settings.studio.customPrintMarkup));
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

  async addItem(
    itemId: string,
    quantity: number,
    userId?: string,
    sessionId?: string,
    customData?: any,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    if (customData) {
      if (!customData.productId || typeof customData.productId !== 'string') {
        throw new BadRequestException('customData must contain a valid productId');
      }
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
        isDeleted: false,
        product: {
          status: ProductStatus.PUBLISHED,
          isDeleted: false,
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
      const updatedCount = await tx.$executeRaw`
        INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, updated_at)
        SELECT gen_random_uuid(), ${cart.id}, ${variantId}, ${quantity}, NOW()
        WHERE ${quantity} <= (SELECT stock_quantity FROM product_variants WHERE id = ${variantId} AND is_deleted = false FOR UPDATE)
        ON CONFLICT (cart_id, product_variant_id) DO UPDATE
        SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
        WHERE cart_items.quantity + EXCLUDED.quantity <= (SELECT stock_quantity FROM product_variants WHERE id = EXCLUDED.product_variant_id AND is_deleted = false FOR UPDATE)
      `;

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

    // H-B6 fix: wrap the entire read-modify-write cycle in a transaction
    // and acquire a FOR UPDATE lock on the cart_item row before reading
    // it. Without the row lock, two concurrent updateItem calls on the
    // same item both read the old quantity and the final UPDATE is
    // last-write-wins — silently clobbering one of the user's intents.
    return this.prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findFirst({
          where: userId ? { userId } : { sessionId },
        });

        if (!cart) {
          throw new NotFoundException('Cart not found');
        }

        // Lock the target cart_item row so concurrent updates on the same
        // item serialize. We accept either an id match or a productVariantId
        // match (legacy callers), but the lookup itself happens under the
        // row lock to avoid the read-then-lock race.
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            cart_id: string;
            product_variant_id: string | null;
            quantity: number;
          }>
        >`
        SELECT id, cart_id, product_variant_id, quantity
          FROM cart_items
         WHERE cart_id = ${cart.id}
           AND (id = ${itemId} OR product_variant_id = ${itemId})
         ORDER BY (id = ${itemId}) DESC
         LIMIT 1
           FOR UPDATE
      `;
        const item = lockedRows[0];

        if (!item) {
          throw new NotFoundException('Cart item not found');
        }

        if (item.product_variant_id) {
          const updatedCount = await tx.$executeRaw`
          UPDATE cart_items
          SET quantity = ${quantity}, updated_at = NOW()
          WHERE id = ${item.id}
          AND ${quantity} <= (SELECT stock_quantity FROM product_variants WHERE id = ${item.product_variant_id} FOR UPDATE)
          AND EXISTS (
            SELECT 1 FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.id = ${item.product_variant_id} AND pv.is_deleted = false AND p.status = 'PUBLISHED' AND p.is_deleted = false
          )
        `;

          if (updatedCount === 0) {
            throw new BadRequestException('Requested quantity exceeds available stock');
          }
        } else {
          await tx.cartItem.update({
            where: { id: item.id },
            data: { quantity },
          });
        }

        // Cache invalidation is queued for after the transaction commits —
        // Redis calls are not transactional and would race with a reader
        // that hasn't yet seen our write.
        await tx.$executeRaw`SELECT 1`; // no-op, keeps tx alive
      },
      { timeout: 8_000 },
    );

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
      throw new InternalServerErrorException('Failed to remove item from cart');
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
    // Merge items transactionally
    await this.prisma.$transaction(async (tx) => {
      // BE-006: Acquire advisory lock on userId to prevent concurrent merge races
      const lockHash = crypto.createHash('sha256').update(`cart_merge_${userId}`).digest();
      const lockId = lockHash.readInt32LE(0);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      const guestCart = await tx.cart.findUnique({
        where: { sessionId: guestSessionId },
        include: { items: true },
      });

      if (!guestCart || guestCart.items.length === 0) {
        return;
      }

      const userCart = await this.getOrCreateCart(tx, userId);
      const variants = await tx.productVariant.findMany({
        where: {
          id: {
            in: guestCart.items
              .map((item) => item.productVariantId)
              .filter((id): id is string => id !== null),
          },
        },
        select: { id: true, stockQuantity: true },
      });
      const stockByVariant = new Map(
        variants.map((variant) => [variant.id, variant.stockQuantity]),
      );

      const existingUserItems = await tx.cartItem.findMany({
        where: { cartId: userCart.id },
      });
      const existingUserItemMap = new Map(existingUserItems.map((i) => [i.productVariantId, i]));

      for (const guestItem of guestCart.items) {
        if (!guestItem.productVariantId) {
          const existingCustom = existingUserItems.find(
            (i) =>
              !i.productVariantId &&
              this.customDataKey(i.customData) === this.customDataKey(guestItem.customData),
          );
          if (existingCustom) {
            await tx.cartItem.update({
              where: { id: existingCustom.id },
              data: { quantity: existingCustom.quantity + guestItem.quantity },
            });
          } else {
            await tx.cartItem.create({
              data: {
                cartId: userCart.id,
                quantity: guestItem.quantity,
                customData: guestItem.customData || undefined,
              },
            });
          }
        } else {
          const stock = stockByVariant.get(guestItem.productVariantId) ?? 0;
          if (stock <= 0) continue;
          const finalQty = Math.min(guestItem.quantity, stock);
          await tx.$executeRaw`
            INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, updated_at)
            VALUES (gen_random_uuid(), ${userCart.id}, ${guestItem.productVariantId}, ${finalQty}, NOW())
            ON CONFLICT (cart_id, product_variant_id) DO UPDATE
            SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, ${stock}), updated_at = NOW()
          `;
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

  private customDataKey(customData: any): string | null {
    if (!customData || typeof customData !== 'object' || Array.isArray(customData)) {
      return null;
    }

    const normalizedToOriginal = new Map<string, string>();
    for (const key of Object.keys(customData)) {
      const lower = key.toLowerCase();
      if (lower.startsWith('design') || ['printurl', 'text', 'placement'].includes(lower)) {
        normalizedToOriginal.set(lower, key);
      }
    }

    const designLikeKeys = Array.from(normalizedToOriginal.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    // Canonical order: identifying fields first, then deterministic extras.
    const canonicalKeys = ['productId', 'size', 'color', ...designLikeKeys];

    const parts: string[] = [];
    for (const key of canonicalKeys) {
      const originalKey =
        key === 'productId' || key === 'size' || key === 'color'
          ? key
          : normalizedToOriginal.get(key);
      if (originalKey !== undefined && customData[originalKey] !== undefined) {
        parts.push(`${key}=${JSON.stringify(customData[originalKey])}`);
      }
    }

    return parts.length > 0 ? parts.join('|') : null;
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
