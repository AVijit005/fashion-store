import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ResolveSubmissionDto } from './dto/studio-submission.dto';
import { DesignStatus, SubmissionStatus } from '@prisma/client';

@Injectable()
export class StudioSubmissionService {
  constructor(private prisma: PrismaService) {}

  async submitDesign(userId: string, designId: string, notes?: string) {
    const design = await this.prisma.studioDesign.findUnique({
      where: { id: designId },
    });

    if (!design || design.deletedAt) throw new NotFoundException('Design not found');
    if (design.userId !== userId) throw new ForbiddenException('Access denied');
    if (design.status !== DesignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT designs can be submitted');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Design Status
      await tx.studioDesign.update({
        where: { id: designId },
        data: { status: DesignStatus.SUBMITTED },
      });

      // 2. Create Submission Record
      const submission = await tx.studioSubmission.create({
        data: {
          designId,
          status: SubmissionStatus.SUBMITTED,
          notes,
        },
      });

      // 3. Log History
      await tx.studioStatusHistory.create({
        data: {
          submissionId: submission.id,
          newStatus: SubmissionStatus.SUBMITTED,
          userId, // Action by the creator
          notes: 'Initial submission',
        },
      });

      return submission;
    });
  }

  async listSubmissions(status?: SubmissionStatus) {
    return this.prisma.studioSubmission.findMany({
      where: status ? { status } : undefined,
      include: {
        design: {
          select: { id: true, title: true, previewImageUrl: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubmission(id: string) {
    const submission = await this.prisma.studioSubmission.findUnique({
      where: { id },
      include: {
        design: {
          include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async reviewSubmission(adminId: string, id: string) {
    const submission = await this.getSubmission(id);

    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED designs can be placed under review');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studioSubmission.update({
        where: { id },
        data: {
          status: SubmissionStatus.UNDER_REVIEW,
          reviewerId: adminId,
        },
      });

      await tx.studioDesign.update({
        where: { id: submission.designId },
        data: { status: DesignStatus.UNDER_REVIEW },
      });

      await tx.studioStatusHistory.create({
        data: {
          submissionId: id,
          oldStatus: SubmissionStatus.SUBMITTED,
          newStatus: SubmissionStatus.UNDER_REVIEW,
          userId: adminId,
          notes: 'Placed under review by Admin',
        },
      });

      return updated;
    });
  }

  async resolveSubmission(adminId: string, id: string, dto: ResolveSubmissionDto) {
    const submission = await this.getSubmission(id);

    if (
      submission.status !== SubmissionStatus.UNDER_REVIEW &&
      submission.status !== SubmissionStatus.SUBMITTED
    ) {
      throw new BadRequestException('Submission is already resolved');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studioSubmission.update({
        where: { id },
        data: {
          status: dto.status,
          reviewerId: adminId,
          notes: dto.notes,
        },
      });

      // Sync with parent design
      await tx.studioDesign.update({
        where: { id: submission.designId },
        data: {
          status:
            dto.status === SubmissionStatus.APPROVED
              ? DesignStatus.APPROVED
              : DesignStatus.REJECTED,
        },
      });

      await tx.studioStatusHistory.create({
        data: {
          submissionId: id,
          oldStatus: submission.status,
          newStatus: dto.status,
          userId: adminId,
          notes: dto.notes || `Resolved to ${dto.status}`,
        },
      });

      return updated;
    });
  }
}
