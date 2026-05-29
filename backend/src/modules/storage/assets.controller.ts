import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { StorageService } from './storage.service';
import { PrismaService } from '../../config/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import * as crypto from 'crypto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate a presigned URL to upload a new asset directly to S3' })
  @ApiResponse({
    status: 201,
    description: 'Returns the asset record and the presigned upload URL',
  })
  async requestUploadUrl(@Req() req: any, @Body() dto: CreateAssetDto) {
    // Basic validations
    if (dto.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException('Invalid file type');
    }

    const userId = req.user.id;
    // Generate a unique storage key
    const extension = dto.filename.split('.').pop() || '';
    const storageKey = `assets/${userId}/${crypto.randomUUID()}.${extension}`;

    // Create the asset record in the database
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        filename: dto.filename,
        mimeType: dto.mimeType,
        size: dto.size,
        width: dto.width,
        height: dto.height,
        storageKey,
      },
    });

    // Generate the presigned URL
    const uploadUrl = await this.storageService.generateUploadPresignedUrl(
      storageKey,
      dto.mimeType,
    );

    return {
      asset,
      uploadUrl,
    };
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm asset upload completed successfully' })
  @ApiResponse({ status: 200, description: 'Asset status updated to UPLOADED' })
  async confirmUpload(@Req() req: any, @Param('id') id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (asset.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to access this asset');
    }

    if (asset.status !== 'PENDING') {
      throw new BadRequestException(`Asset status is already ${asset.status}`);
    }

    return this.prisma.asset.update({
      where: { id },
      data: { status: 'UPLOADED' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a temporary download URL for an asset' })
  @ApiResponse({ status: 200, description: 'Returns a presigned download URL' })
  async getAssetUrl(@Req() req: any, @Param('id') id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset || asset.status === 'DELETED') {
      throw new NotFoundException('Asset not found');
    }

    // Ensure the user owns the asset or is an admin
    if (asset.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to view this asset');
    }

    if (asset.status === 'PENDING') {
      throw new BadRequestException('Asset upload is not confirmed yet');
    }

    const downloadUrl = await this.storageService.generateDownloadPresignedUrl(asset.storageKey);

    return {
      downloadUrl,
      asset,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an asset' })
  async deleteAsset(@Req() req: any, @Param('id') id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset || asset.status === 'DELETED') {
      throw new NotFoundException('Asset not found');
    }

    if (asset.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to delete this asset');
    }

    // Delete from S3
    await this.storageService.deleteObject(asset.storageKey);

    // Soft delete in database by setting status to DELETED
    await this.prisma.asset.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }
}
