import { IsString, IsOptional, IsObject, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateStatus } from '@prisma/client';

export class CreateCreatorTemplateDto {
  @ApiProperty({ example: 'Basic Black Tee Template' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Starting point for dark themes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'url-to-preview.jpg' })
  @IsOptional()
  @IsString()
  previewImage?: string;

  @ApiPropertyOptional({ example: 'T-Shirts' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['dark', 'streetwear', 'tee'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'version-uuid-here' })
  @IsOptional()
  @IsString()
  designVersionId?: string;

  @ApiPropertyOptional({ example: { width: 800, height: 600, elements: [] } })
  @IsOptional()
  @IsObject()
  designJson?: Record<string, any>;
}

export class UpdateCreatorTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  designJson?: Record<string, any>;
}
