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

    const recentOrders = await this.prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const seriesMap = new Map<string, { revenue: number; orders: number }>();
    for(let i=30; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      seriesMap.set(dateStr, { revenue: 0, orders: 0 });
    }

    recentOrders.forEach(order => {
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (seriesMap.has(dateStr)) {
         const existing = seriesMap.get(dateStr)!;
         existing.revenue += Number(order.totalAmount);
         existing.orders += 1;
      }
    });

    const series = Array.from(seriesMap.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders
    }));

    const categoriesAggr = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: thirtyDaysAgo } } },
      include: {
        productVariant: {
          include: { product: { include: { category: true } } }
        }
      }
    });

    const catMap = new Map<string, { revenue: number, orders: number }>();
    for (const item of categoriesAggr) {
      const catName = item.productVariant?.product?.category?.name || 'Uncategorized';
      const existing = catMap.get(catName) || { revenue: 0, orders: 0 };
      existing.revenue += Number(item.priceAtPurchase) * item.quantity;
      existing.orders += 1;
      catMap.set(catName, existing);
    }
    
    const topCategories = Array.from(catMap.entries())
      .map(([name, data]) => ({ name, revenue: data.revenue, orders: data.orders }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

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
