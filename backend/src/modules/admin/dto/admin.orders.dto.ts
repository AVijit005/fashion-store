import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEmail, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNumber()
  @Min(1)
  qty: number;
}

export class CreatePosOrderDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
