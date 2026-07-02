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
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Throttle } from '@nestjs/throttler';
import { StorageService } from './storage.service';
import { PrismaService } from '../../config/prisma.service';
import { Env } from '../../config/env.config';
import { CreateAssetDto } from './dto/create-asset.dto';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import * as crypto from 'crypto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('assets')
export class AssetsController {
  private readonly ALLOWED_MIME_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env>,
  ) {}

  private getPublicUrl(storageKey: string): string {
    const bucket = this.configService.get('AWS_S3_BUCKET', 'aura-studio');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    if (endpoint) {
      // Local MinIO
      return `${endpoint}/${bucket}/${storageKey}`;
    }
    // AWS S3
    const region = this.configService.get('AWS_REGION', 'us-east-1');
    return `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
  }

  @Post('upload-url')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a presigned URL to upload a new asset directly to S3' })
  @ApiResponse({
    status: 201,
    description: 'Returns the asset record and the presigned upload URL',
  })
  async requestUploadUrl(@Req() req: RequestWithUser, @Body() dto: CreateAssetDto) {
    // Basic validations
    if (dto.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Path/filename validation: must be a non-empty string and cannot contain path separators
    if (typeof dto.filename !== 'string' || dto.filename.length === 0) {
      throw new BadRequestException('Invalid filename');
    }
    if (dto.filename.includes('/') || dto.filename.includes('\\')) {
      throw new BadRequestException('Invalid filename');
    }

    if (!this.ALLOWED_MIME_TYPES[dto.mimeType]) {
      throw new BadRequestException('Invalid file type');
    }

    const userId = req.user.id;
    // Generate a unique storage key using the securely mapped extension
    const extension = this.ALLOWED_MIME_TYPES[dto.mimeType];
    const storageKey = `assets/${userId}/${crypto.randomUUID()}.${extension}`;

    // Create the asset record in the database
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        filename: dto.filename.replace(/[^a-zA-Z0-9.\-_ ]/g, '_'),
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
      publicUrl: this.getPublicUrl(storageKey),
    };
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm asset upload completed successfully' })
  @ApiResponse({ status: 200, description: 'Asset status updated to UPLOADED' })
  async confirmUpload(@Req() req: RequestWithUser, @Param('id') id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (asset.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to access this asset');
    }

    const metadata = await this.storageService.getObjectMetadata(asset.storageKey);
    if (!metadata.ContentLength || metadata.ContentLength === 0) {
      await this.prisma.asset.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Uploaded file is empty or missing from storage');
    }

    if (metadata.ContentType !== asset.mimeType) {
      await this.prisma.asset.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Uploaded file type does not match the requested asset type');
    }

    // Reject disallowed MIME types even when they match the requested asset type (defense in depth)
    if (metadata.ContentType && !this.ALLOWED_MIME_TYPES[metadata.ContentType]) {
      await this.prisma.asset.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Uploaded file type is not allowed');
    }

    const result = await this.prisma.asset.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'UPLOADED', size: metadata.ContentLength },
    });

    if (result.count === 0) {
      // Re-fetch to give an accurate error message (someone else already confirmed it)
      const currentAsset = await this.prisma.asset.findUnique({ where: { id } });
      throw new BadRequestException(`Asset status is already ${currentAsset?.status}`);
    }

    const updatedAsset = await this.prisma.asset.findUnique({ where: { id } });
    return { ...updatedAsset, publicUrl: this.getPublicUrl(asset.storageKey) };
  }

  @Get(':id')
  @SkipTransform()
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

    // Soft delete in database by setting status to DELETED
    await this.prisma.asset.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    // Delete from S3 after the database no longer exposes the asset
    await this.storageService.deleteObject(asset.storageKey);
  }
}
