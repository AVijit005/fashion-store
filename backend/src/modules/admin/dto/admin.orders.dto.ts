import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEmail,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  id!: string;

  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreatePosOrderDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

import { OrderStatus } from '@prisma/client';

export class UpdateBulkStatusDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds!: string[];

  @IsString()
  status!: OrderStatus;
}
