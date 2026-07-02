import { PrismaService } from '../../src/config/prisma.service';
import { ProductStatus } from '@prisma/client';

export interface CreateProductOptions {
  title?: string;
  slug?: string;
  basePrice?: number;
  status?: ProductStatus;
  categoryId: string;
  stockQuantity?: number;
  variantSku?: string;
  variantSize?: string;
  variantColor?: string;
  priceOverride?: number;
}

let counter = 0;

export async function createProduct(prisma: PrismaService, options: CreateProductOptions) {
  counter++;
  const title = options.title ?? `Test Product ${counter}`;
  const slug = options.slug ?? `test-product-${counter}`;

  return prisma.product.create({
    data: {
      title,
      slug,
      description: `Auto-generated product ${counter}`,
      basePrice: options.basePrice ?? 2999,
      status: options.status ?? ProductStatus.PUBLISHED,
      categoryId: options.categoryId,
      mediaUrls: [],
      tags: ['test'],
      variants: {
        create: {
          sku: options.variantSku ?? `SKU-${counter}`,
          size: options.variantSize ?? 'M',
          color: options.variantColor ?? 'Black',
          stockQuantity: options.stockQuantity ?? 10,
          priceOverride: options.priceOverride ?? null,
          mediaUrls: [],
        },
      },
    },
    include: { variants: true },
  });
}
