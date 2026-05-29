import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateStudioDesignDto, UpdateStudioDesignDto } from './dto/studio-design.dto';
import { designJsonSchema } from './dto/design-json.schema';
import { DesignStatus } from '@prisma/client';

@Injectable()
export class StudioDesignService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateStudioDesignDto) {
    // Validate JSON schema
    const parsedJson = designJsonSchema.safeParse(dto.designJson);
    if (!parsedJson.success) {
      throw new BadRequestException(`Invalid design JSON: ${parsedJson.error.message}`);
    }

    // Create design and its first version in a transaction
    return this.prisma.$transaction(async (tx) => {
      const design = await tx.studioDesign.create({
        data: {
          userId,
          title: dto.title,
          description: dto.description,
          status: DesignStatus.DRAFT,
        },
      });

      const version = await tx.designVersion.create({
        data: {
          designId: design.id,
          versionNumber: 1,
          designJson: parsedJson.data as any,
        },
      });

      return { ...design, latestVersion: version };
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.studioDesign.findMany({
      where: { userId, deletedAt: null },
      include: {
        _count: {
          select: { versions: true, submissions: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const design = await this.prisma.studioDesign.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1, // Usually just want the latest version for the editor
        },
      },
    });

    if (!design || design.deletedAt) {
      throw new NotFoundException('Design not found');
    }

    if (design.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return design;
  }

  async update(userId: string, id: string, dto: UpdateStudioDesignDto) {
    const design = await this.prisma.studioDesign.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!design || design.deletedAt) {
      throw new NotFoundException('Design not found');
    }

    if (design.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // A design under review shouldn't be mutable until resolved
    if (design.status === DesignStatus.UNDER_REVIEW || design.status === DesignStatus.SUBMITTED) {
      throw new BadRequestException(
        'Cannot edit a design that is currently submitted or under review',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update parent design fields if provided
      const updatedDesign = await tx.studioDesign.update({
        where: { id },
        data: {
          title: dto.title ?? design.title,
          description: dto.description ?? design.description,
          // Editing an approved/rejected design resets it to DRAFT
          status:
            design.status === DesignStatus.APPROVED || design.status === DesignStatus.REJECTED
              ? DesignStatus.DRAFT
              : design.status,
        },
      });

      let latestVersion = design.versions[0];

      // If new designJson provided, create a new version
      if (dto.designJson) {
        const parsedJson = designJsonSchema.safeParse(dto.designJson);
        if (!parsedJson.success) {
          throw new BadRequestException(`Invalid design JSON: ${parsedJson.error.message}`);
        }

        const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

        latestVersion = await tx.designVersion.create({
          data: {
            designId: design.id,
            versionNumber: newVersionNumber,
            designJson: parsedJson.data as any,
          },
        });
      }

      return { ...updatedDesign, latestVersion };
    });
  }

  async duplicate(userId: string, id: string) {
    const design = await this.findOne(userId, id); // validates ownership and non-deleted status

    return this.prisma.$transaction(async (tx) => {
      const newDesign = await tx.studioDesign.create({
        data: {
          userId,
          title: `${design.title} (Copy)`,
          description: design.description,
          status: DesignStatus.DRAFT,
        },
      });

      const latestVersion = design.versions[0];
      let versionJson = { width: 800, height: 600, elements: [] };
      if (latestVersion) {
        versionJson = latestVersion.designJson as any;
      }

      const newVersion = await tx.designVersion.create({
        data: {
          designId: newDesign.id,
          versionNumber: 1,
          designJson: versionJson as any,
        },
      });

      return { ...newDesign, latestVersion: newVersion };
    });
  }

  async remove(userId: string, id: string) {
    const design = await this.prisma.studioDesign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!design) {
      throw new NotFoundException('Design not found');
    }

    return this.prisma.studioDesign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async rollback(userId: string, id: string, versionNumber: number) {
    const design = await this.prisma.studioDesign.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!design || design.deletedAt) {
      throw new NotFoundException('Design not found');
    }

    if (design.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (design.status === DesignStatus.UNDER_REVIEW || design.status === DesignStatus.SUBMITTED) {
      throw new BadRequestException(
        'Cannot edit a design that is currently submitted or under review',
      );
    }

    const targetVersion = design.versions.find((v) => v.versionNumber === versionNumber);
    if (!targetVersion) {
      throw new BadRequestException(`Version ${versionNumber} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const latestVersionNumber = design.versions[0]?.versionNumber || 0;
      const newVersionNumber = latestVersionNumber + 1;

      const newVersion = await tx.designVersion.create({
        data: {
          designId: id,
          versionNumber: newVersionNumber,
          designJson: targetVersion.designJson as any,
        },
      });

      const updatedDesign = await tx.studioDesign.update({
        where: { id },
        data: {
          status:
            design.status === DesignStatus.APPROVED || design.status === DesignStatus.REJECTED
              ? DesignStatus.DRAFT
              : design.status,
        },
      });

      return { ...updatedDesign, latestVersion: newVersion };
    });
  }
}
