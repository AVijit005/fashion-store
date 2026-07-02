import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefundDto {
  @ApiProperty({ description: 'Razorpay payment ID to refund' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  razorpayPaymentId!: string;

  @ApiProperty({ description: 'Amount in INR to refund (omit for full refund)', required: false })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @ApiProperty({ description: 'Reason recorded against the refund', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
