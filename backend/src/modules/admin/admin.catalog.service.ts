import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(page: number = 1, limit: number = 15, q?: string) {
    const where: Prisma.ProductWhereInput = { isDeleted: false };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          collections: true,
          variants: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createProduct(data: any) {
    const { categoryId, collectionId, variantsData, images, image, name, price, isActive, compareAtPrice, dropId, isFeatured, slug, description } = data;
    return this.prisma.product.create({
      data: {
        title: name,
        slug,
        description: description || '',
        basePrice: price,
        status: isActive ? 'PUBLISHED' : 'DRAFT',
        isFeatured: isFeatured || false,
        categoryId,
        dropId,
        collections: collectionId ? { connect: { id: collectionId } } : undefined,
        mediaUrls: images || (image ? [image] : []),
        variants: variantsData
          ? {
              create: variantsData.map((v: any) => ({
                sku: v.sku,
                size: v.size,
                color: v.color || '',
                stockQuantity: v.stock || 0,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });
  }

  async updateProduct(id: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id, isDeleted: false } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { variantsData, images, image, categoryId, collectionId, dropId, name, price, isActive, compareAtPrice, slug, description, isFeatured } = data;

    if (variantsData) {
      await this.prisma.productVariant.updateMany({
        where: {
          productId: id,
          id: { notIn: variantsData.map((v: any) => v.id).filter(Boolean) },
        },
        data: { isDeleted: true },
      });
      for (const v of variantsData) {
        if (v.id) {
          await this.prisma.productVariant.update({
            where: { id: v.id },
            data: { sku: v.sku, size: v.size, color: v.color || '', stockQuantity: v.stock || 0 },
          });
        } else {
          await this.prisma.productVariant.create({
            data: {
              productId: id,
              sku: v.sku,
              size: v.size,
              color: v.color || '',
              stockQuantity: v.stock || 0,
            },
          });
        }
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(name && { title: name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { basePrice: price }),
        ...(isActive !== undefined && { status: isActive ? 'PUBLISHED' : 'DRAFT' }),
        ...(isFeatured !== undefined && { isFeatured }),
        categoryId,
        dropId,
        collections: collectionId ? { set: [{ id: collectionId }] } : undefined,
        mediaUrls: images ? images : (image ? [image] : undefined),
      },
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
