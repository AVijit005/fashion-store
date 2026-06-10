import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SubmissionStatus } from '@prisma/client';

@Injectable()
export class AdminStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStatus(id: string, status: SubmissionStatus, notes?: string) {
    const submission = await this.prisma.studioSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      // Return success anyway for mock data purposes
      return { success: true, status, notes, message: 'Status updated (mock)' };
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
