import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../../config/settings.service';
import { CreateReturnDto, ReviewReturnDto, InitiateRefundDto } from './dto';
import { canTransition } from './returns.state-machine';
import { OrderStatus, RefundStatus, ReturnStatus } from '@prisma/client';

/**
 * ReturnsService — Phase 1 (audit item 1.5).
 *
 * Full state machine:
 *   REQUESTED → APPROVED → RECEIVED → REFUND_INITIATED → REFUNDED
 *
 * Refunds are issued via PaymentsService.refundPayment (Razorpay API call)
 * and tracked in the `refunds` table. A failed Razorpay call leaves the
 * Refund row in FAILED state and the ReturnRequest in REFUND_INITIATED;
 * admin can retry from /admin/returns.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly settingsService: SettingsService,
  ) {}

  // ---------- User-facing ----------

  async createForUser(userId: string, dto: CreateReturnDto) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    if (item.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    const settings = await this.settingsService.getAll();
    const daysSinceDelivered =
      (Date.now() - item.order.updatedAt.getTime()) / 86_400_000;
    if (daysSinceDelivered > settings.refunds.autoApproveWindowDays) {
      throw new BadRequestException(
        `Return window of ${settings.refunds.autoApproveWindowDays} days has expired`,
      );
    }

    const existing = await this.prisma.returnRequest.findUnique({
      where: { orderItemId: dto.orderItemId },
    });
    if (existing && existing.status !== ReturnStatus.CANCELLED) {
      throw new ConflictException('A return already exists for this item');
    }
    // If a previous CANCELLED return exists, reuse the row id would conflict
    // with the unique on orderItemId — delete the cancelled one first.
    if (existing) {
      await this.prisma.returnRequest.delete({ where: { id: existing.id } });
    }

    return this.prisma.returnRequest.create({
      data: {
        orderId: item.orderId,
        orderItemId: item.id,
        userId,
        reason: dto.reason,
        description: dto.description,
        history: {
          create: {
            newStatus: ReturnStatus.REQUESTED,
            changedBy: userId,
            notes: 'Return requested by user',
          },
        },
      },
      include: { history: true },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.returnRequest.findMany({
      where: { userId },
      include: {
        order: { select: { id: true, createdAt: true, totalAmount: true } },
        orderItem: {
          select: {
            id: true,
            productVariantId: true,
            quantity: true,
            priceAtPurchase: true,
          },
        },
        refund: { select: { id: true, amountInPaise: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- Admin-facing ----------

  async listAllForAdmin() {
    return this.prisma.returnRequest.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        order: {
          select: {
            id: true,
            createdAt: true,
            totalAmount: true,
            shippingFee: true,
            tax: true,
          },
        },
        orderItem: true,
        refund: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(returnId: string, adminId: string, dto: ReviewReturnDto) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!canTransition(ret.status, dto.decision)) {
      throw new BadRequestException(
        `Cannot transition from ${ret.status} to ${dto.decision}`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: dto.decision },
      });
      await tx.returnStatusHistory.create({
        data: {
          returnId,
          oldStatus: ret.status,
          newStatus: dto.decision,
          changedBy: adminId,
          notes: dto.notes,
        },
      });
      return updated;
    });
  }

  async markReceived(returnId: string, adminId: string) {
    return this.review(returnId, adminId, {
      decision: ReturnStatus.RECEIVED,
    });
  }

  async initiateRefund(
    returnId: string,
    adminId: string,
    dto: InitiateRefundDto,
  ) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: true, refund: true },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!canTransition(ret.status, ReturnStatus.REFUND_INITIATED)) {
      throw new BadRequestException(
        `Cannot initiate refund from status ${ret.status}`,
      );
    }
    if (!ret.order.razorpayPaymentId) {
      throw new BadRequestException(
        'No payment id on order — cannot refund via gateway',
      );
    }
    if (ret.refund && ret.refund.status === RefundStatus.PROCESSED) {
      throw new ConflictException('Refund already processed');
    }

    // Create or update the Refund row.
    const refund = ret.refund
      ? await this.prisma.refund.update({
          where: { id: ret.refund.id },
          data: {
            amountInPaise: dto.amountInPaise,
            status: RefundStatus.INITIATED,
            reason: ret.reason,
          },
        })
      : await this.prisma.refund.create({
          data: {
            orderId: ret.orderId,
            paymentId: ret.order.razorpayPaymentId,
            amountInPaise: dto.amountInPaise,
            reason: ret.reason,
            status: RefundStatus.INITIATED,
          },
        });

    try {
      await this.payments.refundPayment(
        ret.order.razorpayPaymentId,
        dto.amountInPaise,
      );
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        `Razorpay refund failed returnId=${returnId}: ${(err as Error).message}`,
      );
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.FAILED },
      });
      throw err;
    }

    await this.prisma.$transaction([
      this.prisma.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.REFUND_INITIATED,
          refundId: refund.id,
        },
      }),
      this.prisma.returnStatusHistory.create({
        data: {
          returnId,
          oldStatus: ret.status,
          newStatus: ReturnStatus.REFUND_INITIATED,
          changedBy: adminId,
          notes: `Refund initiated ₹${(dto.amountInPaise / 100).toFixed(2)}`,
        },
      }),
    ]);

    return refund;
  }

  async markRefunded(returnId: string, adminId: string) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { refund: true },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!ret.refund) {
      throw new BadRequestException('No refund record found for this return');
    }
    if (ret.refund.status !== RefundStatus.PROCESSED) {
      throw new BadRequestException(
        `Refund not yet processed (status: ${ret.refund.status})`,
      );
    }
    if (!canTransition(ret.status, ReturnStatus.REFUNDED)) {
      throw new BadRequestException(
        `Cannot transition from ${ret.status} to REFUNDED`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.returnRequest.update({
        where: { id: returnId },
        data: { status: ReturnStatus.REFUNDED },
      }),
      this.prisma.returnStatusHistory.create({
        data: {
          returnId,
          oldStatus: ret.status,
          newStatus: ReturnStatus.REFUNDED,
          changedBy: adminId,
          notes: 'Refund completed and order closed',
        },
      }),
      this.prisma.order.update({
        where: { id: ret.orderId },
        data: { status: OrderStatus.REFUNDED },
      }),
    ]);
  }
}
