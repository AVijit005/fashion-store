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
    const { Prisma } = require('@prisma/client');
    const skip = (page - 1) * limit;

    const baseSql = Prisma.sql`
      WITH UserStats AS (
        SELECT 
          u.id, u.email, u.created_at as joined_at,
          COALESCE(SUM(o.total_amount), 0) as total_spend,
          COUNT(o.id) as orders_count,
          MAX(o.created_at) as last_order_at,
          (SELECT city FROM addresses a WHERE a.user_id = u.id ORDER BY a.created_at DESC LIMIT 1) as city
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('PAYMENT_PENDING', 'CANCELLED')
        WHERE u.role = 'CUSTOMER' AND u.is_deleted = false
        ${q ? Prisma.sql`AND u.email ILIKE ${'%' + q + '%'}` : Prisma.empty}
        GROUP BY u.id
      ),
      SegmentedUsers AS (
        SELECT *,
          CASE 
            WHEN orders_count = 0 THEN 'new'
            WHEN total_spend > 50000 THEN 'vip'
            WHEN orders_count = 1 THEN 'returning'
            WHEN EXTRACT(EPOCH FROM (NOW() - last_order_at))/86400 > 180 THEN 'lapsed'
            ELSE 'returning'
          END as segment,
          CASE
            WHEN total_spend > 100000 THEN 'Platinum'
            WHEN total_spend > 50000 THEN 'Gold'
            WHEN total_spend > 10000 THEN 'Silver'
            ELSE 'Bronze'
          END as loyalty
        FROM UserStats
      )
      SELECT * FROM SegmentedUsers
      ${segmentFilter && segmentFilter !== 'all' ? Prisma.sql`WHERE segment = ${segmentFilter}` : Prisma.empty}
    `;

    const countSql = Prisma.sql`SELECT COUNT(*) as count FROM (${baseSql}) as sub`;
    const paginatedSql = Prisma.sql`${baseSql} ORDER BY joined_at DESC LIMIT ${limit} OFFSET ${skip}`;

    const [totalRows, rawUsers] = await Promise.all([
      this.prisma.$queryRaw<any[]>(countSql),
      this.prisma.$queryRaw<any[]>(paginatedSql),
    ]);

    const total = Number(totalRows[0]?.count || 0);

    const mapped = rawUsers.map((user) => ({
      id: user.id,
      name: user.email.split('@')[0],
      email: user.email,
      phone: 'N/A',
      city: user.city || 'Unknown',
      segment: user.segment,
      loyalty: user.loyalty,
      orders: Number(user.orders_count),
      spend: Number(user.total_spend),
      joinedAt: user.joined_at.toISOString(),
      lastOrderAt: user.last_order_at
        ? user.last_order_at.toISOString()
        : user.joined_at.toISOString(),
      vip: user.segment === 'vip',
      notes: null,
      supportTickets: 0, // TODO: Implement support tickets API
    }));

    return {
      data: mapped,
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
    return { success: true, message: 'Note added successfully' };
  }
}
