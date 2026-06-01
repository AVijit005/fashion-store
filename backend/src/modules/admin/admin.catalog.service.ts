import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        collections: true,
        variants: true,
      },
    });
  }

  async createProduct(data: any) {
    const { categoryId, collectionId, variants, ...productData } = data;
    return this.prisma.product.create({
      data: {
        ...productData,
        categoryId,
        collectionId,
        variants: variants ? { create: variants } : undefined,
      },
      include: { variants: true },
    });
  }

  async updateProduct(id: string, data: any) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { variants, ...productData } = data;
    
    // Simplistic variant update: just update product for now
    return this.prisma.product.update({
      where: { id },
      data: productData,
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
