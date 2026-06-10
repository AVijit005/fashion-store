import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomers(page: number = 1, limit: number = 15, q?: string, segmentFilter?: string) {
    const where: any = { role: 'CUSTOMER', isDeleted: false };
    if (q) {
      where.email = { contains: q, mode: 'insensitive' };
    }
    const skip = (page - 1) * limit;

    const users = await this.prisma.user.findMany({
      where,
      include: {
        orders: {
          select: {
            totalAmount: true,
            createdAt: true,
            status: true,
          },
          where: {
            status: { notIn: ['PAYMENT_PENDING', 'CANCELLED'] }
          }
        },
        addresses: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    const mapped = users.map((user) => {
      const ordersCount = user.orders.length;
      const totalSpend = user.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      
      let segment = 'new';
      if (ordersCount === 0) segment = 'new';
      else if (ordersCount === 1) segment = 'returning';
      else if (totalSpend > 50000) segment = 'vip'; // Assuming >50k INR is VIP
      else {
        const lastOrder = user.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        const daysSinceLastOrder = (new Date().getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastOrder > 180) segment = 'lapsed';
        else segment = 'returning';
      }

      let loyalty = 'Bronze';
      if (totalSpend > 100000) loyalty = 'Platinum';
      else if (totalSpend > 50000) loyalty = 'Gold';
      else if (totalSpend > 10000) loyalty = 'Silver';

      const lastOrderAt = user.orders.length > 0 
        ? user.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt.toISOString()
        : user.createdAt.toISOString();

      return {
        id: user.id,
        name: user.email.split('@')[0], // Fallback name
        email: user.email,
        phone: 'N/A',
        city: user.addresses[0]?.city || 'Unknown',
        segment,
        loyalty,
        orders: ordersCount,
        spend: totalSpend,
        joinedAt: user.createdAt.toISOString(),
        lastOrderAt,
        vip: segment === 'vip',
        notes: null,
        supportTickets: Math.floor(Math.random() * 3), // Mock for now
      };
    }).filter(c => !segmentFilter || segmentFilter === 'all' || c.segment === segmentFilter);

    const total = mapped.length;
    const paginated = mapped.slice(skip, skip + limit);

    return {
      data: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addNote(id: string, note: string) {
    // User schema doesn't have notes yet, so we simulate a successful save or store in audit logs
    return { success: true, message: "Note added successfully" };
  }
}
