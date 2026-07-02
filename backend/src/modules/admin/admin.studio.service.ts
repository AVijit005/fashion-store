import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SubmissionStatus } from '@prisma/client';

@Injectable()
export class AdminStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubmissions() {
    const submissions = await this.prisma.studioSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      include: { design: { include: { user: { select: { name: true, email: true } } } } },
    });
    return { success: true, data: submissions };
  }

  async updateStatus(id: string, status: SubmissionStatus, userId: string, notes?: string) {
    const submission = await this.prisma.studioSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Studio submission not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.studioSubmission.update({
        where: { id },
        data: {
          status,
          notes: notes ? notes : undefined,
          reviewerId: userId,
        },
      });

      await tx.studioStatusHistory.create({
        data: {
          submissionId: id,
          oldStatus: submission.status,
          newStatus: status,
          userId,
          notes,
        },
      });

      return result;
    });

    return { success: true, data: updated };
  }
}
