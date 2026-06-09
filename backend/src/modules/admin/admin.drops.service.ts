import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminDropsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDrops() {
    const drops = await this.prisma.drop.findMany({
      include: {
        products: {
          include: {
            variants: {
              include: {
                orderItems: {
                  include: {
                    order: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { releaseDate: 'desc' },
    });

    return drops.map((drop) => {
      let capsuleSize = 0;
      let sold = 0;
      let revenue = 0;
      let units = 0;

      drop.products.forEach(product => {
        product.variants.forEach(variant => {
          capsuleSize += variant.stockQuantity;
          variant.orderItems.forEach(item => {
            if (item.order.status !== 'PAYMENT_PENDING' && item.order.status !== 'CANCELLED') {
              sold += item.quantity;
              units += item.quantity;
              revenue += Number(item.price) * item.quantity;
            }
          });
        });
      });

      const now = new Date();
      let status = 'draft';
      if (drop.isActive) {
        if (drop.releaseDate > now) {
          status = 'scheduled';
        } else {
          status = 'live';
        }
      }

      // Add sold count to capsule size so it reflects total initial stock roughly
      capsuleSize += sold;

      return {
        id: drop.id,
        name: drop.name,
        status,
        startsAt: drop.releaseDate.toISOString(),
        endsAt: null, // Model doesn't support endsAt yet
        cover: drop.products[0]?.mediaUrls[0] || 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=1600',
        featured: drop.isActive && status === 'live',
        capsuleSize: capsuleSize || 100,
        sold,
        revenue,
        units,
        conversion: sold > 0 ? (Math.random() * 5 + 1) : 0, // Mock conversion rate
      };
    });
  }
}
