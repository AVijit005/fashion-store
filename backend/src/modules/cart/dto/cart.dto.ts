import { IsUUID, IsInt, Min, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'ID of the product variant or custom item' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ description: 'Custom design data', required: false })
  @IsOptional()
  customData?: any;

  @ApiProperty({ description: 'Quantity of the item', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity of the item', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class MergeCartDto {
  @ApiProperty({ description: 'Session ID of the guest cart to merge from' })
  @IsUUID()
  @IsNotEmpty()
  guestSessionId!: string;
}
