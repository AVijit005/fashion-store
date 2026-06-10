import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const aggregations = await this.prisma.order.aggregate({
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
      _count: true,
    });

    const dailySeries = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date, 
        SUM(total_amount) as revenue, 
        COUNT(id) as orders
      FROM orders
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
    `;

    const seriesMap = new Map<string, { revenue: number; orders: number }>();
    for(let i=30; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      seriesMap.set(dateStr, { revenue: 0, orders: 0 });
    }

    dailySeries.forEach(row => {
      const d = new Date(row.date);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (seriesMap.has(dateStr)) {
         const existing = seriesMap.get(dateStr)!;
         existing.revenue += Number(row.revenue);
         existing.orders += Number(row.orders);
      }
    });

    const series = Array.from(seriesMap.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders
    }));

    const categoriesAggr = await this.prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as name, 
        SUM(oi.price_at_purchase * oi.quantity) as revenue, 
        COUNT(oi.id) as orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.created_at >= ${thirtyDaysAgo}
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    const topCategories = categoriesAggr.map(cat => ({
      name: cat.name,
      revenue: Number(cat.revenue),
      orders: Number(cat.orders)
    }));

    return {
      totalOrders: aggregations._count,
      totalRevenue: Number(aggregations._sum.totalAmount || 0),
      series,
      topCategories,
      conversion: 2.4,
      trafficSources: [
        { source: "Instagram", percentage: 45 },
        { source: "Direct", percentage: 30 },
        { source: "Google Organic", percentage: 25 },
      ]
    };
  }

  async getRecentActivity() {
    // Just fetch recent orders as activity
    const orders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    
    return orders.map(o => ({
      id: o.id,
      time: o.createdAt,
      text: `Order ${o.id.substring(0, 8)} placed`,
      meta: o.user?.email || 'Guest',
      kind: 'order',
    }));
  }
}
