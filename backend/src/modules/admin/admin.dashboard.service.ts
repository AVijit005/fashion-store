import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis() {
    const totalOrders = await this.prisma.order.count();
    
    // Simplistic aggregations
    const aggregations = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
    });
    
    return {
      totalOrders,
      totalRevenue: aggregations._sum.totalAmount || 0,
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
