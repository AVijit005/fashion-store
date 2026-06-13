import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminDropsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDrops() {
    const drops = await this.prisma.drop.findMany({
      include: {
        products: {
          select: {
            mediaUrls: true,
            variants: {
              select: { stockQuantity: true }
            }
          }
        }
      },
      orderBy: { releaseDate: 'desc' },
    });

    const dropIds = drops.map(d => d.id);
    let orderStats: any[] = [];
    if (dropIds.length > 0) {
      orderStats = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 
          p.drop_id as "dropId",
          COALESCE(SUM(oi.quantity), 0) as "sold",
          COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) as "revenue"
        FROM products p
        JOIN product_variants pv ON pv.product_id = p.id
        JOIN order_items oi ON oi.product_variant_id = pv.id
        JOIN orders o ON o.id = oi.order_id
        WHERE p.drop_id IN (${dropIds.map((_, i) => `$${i + 1}`).join(',')})
          AND o.status NOT IN ('PAYMENT_PENDING', 'CANCELLED', 'FAILED')
        GROUP BY p.drop_id
        `,
        ...dropIds
      );
    }

    const statsByDropId = new Map(orderStats.map(stat => [stat.dropId, stat]));

    return drops.map((drop) => {
      let capsuleSize = 0;

      drop.products.forEach(product => {
        product.variants.forEach(variant => {
          capsuleSize += variant.stockQuantity;
        });
      });

      const stats = statsByDropId.get(drop.id) || { sold: 0n, revenue: 0 };
      const sold = Number(stats.sold);
      const revenue = Number(stats.revenue);
      const units = sold;

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
