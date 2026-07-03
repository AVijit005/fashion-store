import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewListResponse {
  items: Array<{
    id: string;
    rating: number;
    comment: string;
    mediaUrls: string[];
    createdAt: Date;
    userName: string;
  }>;
  average: number;
  count: number;
}

/**
 * ReviewsService — Phase 1 (audit item 1.1).
 *
 * Replaces the previous "fake reviews" PDP component that hardcoded 4
 * static review objects. Real reviews are persisted to the `reviews`
 * table; only customers who own a DELIVERED order containing the product
 * may create one (verified-buyer gate).
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate-only fetch (no items). Used by catalog to avoid loading the
   * full review list when only the count + average is needed.
   */
  async getAggregate(productId: string): Promise<{ average: number; count: number }> {
    const result = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      average: result._avg.rating ?? 0,
      count: result._count._all,
    };
  }

  async listForProduct(productId: string, limit = 20, offset = 0): Promise<ReviewListResponse> {
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId, isApproved: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.review.aggregate({
        where: { productId, isApproved: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        mediaUrls: r.mediaUrls,
        createdAt: r.createdAt,
        userName: r.user?.name ?? 'Anonymous',
      })),
      average: aggregate._avg.rating ?? 0,
      count: aggregate._count._all,
    };
  }

  /**
   * Create a review for a product. Verified-buyer gate: user must own at
   * least one DELIVERED order containing this product. One review per
   * user per product.
   */
  async create(productId: string, userId: string, dto: CreateReviewDto): Promise<{ id: string }> {
    const owned = await this.prisma.orderItem.findFirst({
      where: {
        productVariant: { productId },
        order: { userId, status: 'DELIVERED' },
      },
    });
    if (!owned) {
      throw new ForbiddenException('Only customers who purchased this product can review it');
    }

    const existing = await this.prisma.review.findFirst({
      where: { userId, productId },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const created = await this.prisma.review.create({
      data: {
        userId,
        productId,
        rating: dto.rating,
        comment: dto.comment,
        mediaUrls: dto.mediaUrls ?? [],
        // Auto-approve. Admin moderation UI ships in Phase 6.
        isApproved: true,
      },
      select: { id: true },
    });

    this.logger.log(`Review created productId=${productId} userId=${userId} rating=${dto.rating}`);

    return created;
  }

  async approve(reviewId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async reject(reviewId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: false },
    });
  }
}
