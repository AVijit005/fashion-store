import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReturnStatus } from '@prisma/client';

/**
 * Admin-only. Allows APPROVED or REJECTED as the decision from REQUESTED.
 * All other status changes go through the dedicated endpoints (received,
 * initiate-refund, mark-refunded).
 */
export class ReviewReturnDto {
  @IsEnum(ReturnStatus)
  decision!: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
