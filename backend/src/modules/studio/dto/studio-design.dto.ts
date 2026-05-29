import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudioDesignDto {
  @ApiProperty({ example: 'My Awesome Hoodie', description: 'Title of the design' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Front and back print', description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: { width: 800, height: 600, elements: [] },
    description: 'The editor JSON state',
  })
  @IsObject()
  designJson!: Record<string, any>;
}

export class UpdateStudioDesignDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: { width: 800, height: 600, elements: [] } })
  @IsOptional()
  @IsObject()
  designJson?: Record<string, any>;
}
