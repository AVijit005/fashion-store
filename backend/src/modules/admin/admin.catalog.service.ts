import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    return this.prisma.product.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        collections: true,
        variants: true,
      },
    });
  }

  async createProduct(data: any) {
    const { categoryId, collectionId, variantsData, images, image, ...productData } = data;
    return this.prisma.product.create({
      data: {
        ...productData,
        categoryId,
        collectionId,
        mediaUrls: images || [],
        variants: variantsData ? {
          create: variantsData.map((v: any) => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            stockQuantity: v.stock || 0,
          }))
        } : undefined,
      },
      include: { variants: true },
    });
  }

  async updateProduct(id: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id, isDeleted: false } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { variantsData, images, image, categoryId, collectionId, dropId, ...productData } = data;
    
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
            data: { sku: v.sku, size: v.size, color: v.color, stockQuantity: v.stock || 0 },
          });
        } else {
          await this.prisma.productVariant.create({
            data: { productId: id, sku: v.sku, size: v.size, color: v.color, stockQuantity: v.stock || 0 },
          });
        }
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        mediaUrls: images ? images : undefined,
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
