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

  async updateStatus(id: string, status: SubmissionStatus, notes?: string) {
    const submission = await this.prisma.studioSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Studio submission not found');
    }

    const updated = await this.prisma.studioSubmission.update({
      where: { id },
      data: {
        status,
        notes: notes ? notes : undefined,
      },
    });

    return { success: true, data: updated };
  }
}
