import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateCreatorTemplateDto, UpdateCreatorTemplateDto } from './dto/creator-template.dto';
import { designJsonSchema } from './dto/design-json.schema';
import { TemplateStatus, DesignStatus } from '@prisma/client';

@Injectable()
export class CreatorTemplateService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCreatorTemplateDto) {
    let finalDesignJson = dto.designJson;
    const finalDesignVersionId = dto.designVersionId;

    if (finalDesignVersionId) {
      const designVersion = await this.prisma.designVersion.findUnique({
        where: { id: finalDesignVersionId },
        include: { design: true },
      });

      if (!designVersion || designVersion.design.deletedAt) {
        throw new NotFoundException('Design version not found');
      }

      if (designVersion.design.userId !== userId) {
        throw new ForbiddenException('You do not own this design');
      }

      finalDesignJson = designVersion.designJson as any;
    } else {
      if (!finalDesignJson) {
        throw new BadRequestException('Either designJson or designVersionId must be provided');
      }
      const parsedJson = designJsonSchema.safeParse(finalDesignJson);
      if (!parsedJson.success) {
        throw new BadRequestException(`Invalid design JSON: ${parsedJson.error.message}`);
      }
      finalDesignJson = parsedJson.data as any;
    }

    return this.prisma.creatorTemplate.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        previewImage: dto.previewImage,
        category: dto.category,
        tags: dto.tags,
        status: TemplateStatus.DRAFT,
        designJson: finalDesignJson as any,
        designVersionId: finalDesignVersionId,
      },
    });
  }

  async findAll(status?: TemplateStatus) {
    // Customers usually only see PUBLISHED templates, admins/creators can see all depending on endpoint
    return this.prisma.creatorTemplate.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.creatorTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(userId: string, userRole: string, id: string, dto: UpdateCreatorTemplateDto) {
    const template = await this.findOne(id);

    // Only owner or admin can update
    if (template.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to edit this template');
    }

    // Enforce template immutability
    if (template.status === TemplateStatus.PUBLISHED) {
      // Check if they are ONLY archiving the template
      const keys = Object.keys(dto) as Array<keyof UpdateCreatorTemplateDto>;
      const isOnlyArchiving =
        dto.status === TemplateStatus.ARCHIVED &&
        keys.filter((k) => dto[k] !== undefined).length === 1;

      if (!isOnlyArchiving) {
        throw new BadRequestException('Published templates are immutable and cannot be modified');
      }
    }

    // If publishing, ensure we are tied to a designVersionId snapshot
    const targetStatus = dto.status ?? template.status;
    const finalDesignVersionId = dto.designVersionId ?? template.designVersionId;
    if (targetStatus === TemplateStatus.PUBLISHED && !finalDesignVersionId) {
      throw new BadRequestException('Published templates must be tied to a DesignVersion snapshot');
    }

    let parsedJson: any = undefined;
    const newDesignVersionId = dto.designVersionId;

    if (newDesignVersionId) {
      const designVersion = await this.prisma.designVersion.findUnique({
        where: { id: newDesignVersionId },
        include: { design: true },
      });

      if (!designVersion || designVersion.design.deletedAt) {
        throw new NotFoundException('Design version not found');
      }

      if (designVersion.design.userId !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException('You do not own this design');
      }

      parsedJson = designVersion.designJson;
    } else if (dto.designJson) {
      const result = designJsonSchema.safeParse(dto.designJson);
      if (!result.success) {
        throw new BadRequestException(`Invalid design JSON: ${result.error.message}`);
      }
      parsedJson = result.data;
    }

    return this.prisma.creatorTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        previewImage: dto.previewImage,
        category: dto.category,
        tags: dto.tags,
        status: dto.status,
        designVersionId: newDesignVersionId,
        ...(parsedJson ? { designJson: parsedJson } : {}),
      },
    });
  }

  async cloneToDesign(userId: string, templateId: string) {
    const template = await this.findOne(templateId);

    if (template.status !== TemplateStatus.PUBLISHED) {
      throw new BadRequestException('Cannot clone an unpublished template');
    }

    return this.prisma.$transaction(async (tx) => {
      const newDesign = await tx.studioDesign.create({
        data: {
          userId,
          title: `Copy of ${template.title}`,
          description: `Created from template: ${template.title}`,
          status: DesignStatus.DRAFT,
        },
      });

      const newVersion = await tx.designVersion.create({
        data: {
          designId: newDesign.id,
          versionNumber: 1,
          designJson: template.designJson as any,
        },
      });

      return { ...newDesign, latestVersion: newVersion };
    });
  }
}
