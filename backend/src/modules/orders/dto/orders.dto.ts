import { IsString, IsEmail, IsNotEmpty, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ description: 'Contact email' })
  @IsEmail()
  @IsNotEmpty()
  shippingEmail!: string;

  @ApiProperty({ description: 'Full name for delivery' })
  @IsString()
  @IsNotEmpty()
  shippingName!: string;

  @ApiProperty({ description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  shippingPhone!: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  shippingStreet!: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  shippingCity!: string;

  @ApiProperty({ description: 'State/Region' })
  @IsString()
  @IsNotEmpty()
  shippingState!: string;

  @ApiProperty({ description: 'Postal/Zip Code' })
  @IsString()
  @IsNotEmpty()
  shippingPostalCode!: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @IsNotEmpty()
  shippingCountry!: string;

  @ApiProperty({ description: 'Guest cart session ID (if not logged in)', required: false })
  @IsUUID()
  @IsOptional()
  guestSessionId?: string;

  @ApiProperty({ description: 'Payment method selected by the user', required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ description: 'Idempotency key to prevent duplicate orders', required: false })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ description: 'Applied coupon code', required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Razorpay order ID returned by checkout endpoint' })
  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @ApiProperty({ description: 'Razorpay payment ID returned by client gateway' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @ApiProperty({ description: 'Razorpay signature hash returned by client gateway' })
  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;
}

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Cart subtotal amount' })
  @IsNumber()
  @IsNotEmpty()
  subtotal!: number;
}
