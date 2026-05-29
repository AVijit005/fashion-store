import { IsString, IsInt, IsOptional, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ example: 'logo.png', description: 'Original filename' })
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: 'image/png', description: 'MIME type of the file' })
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty({ example: 102400, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  size!: number;

  @ApiPropertyOptional({ example: 800, description: 'Image width in pixels' })
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiPropertyOptional({ example: 600, description: 'Image height in pixels' })
  @IsOptional()
  @IsInt()
  height?: number;
}
