import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionStatus } from '@prisma/client';

export class ResolveSubmissionDto {
  @ApiProperty({ enum: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] })
  @IsEnum([SubmissionStatus.APPROVED, SubmissionStatus.REJECTED])
  status!: SubmissionStatus;

  @ApiPropertyOptional({ example: 'Looks great! Approved for printing.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
