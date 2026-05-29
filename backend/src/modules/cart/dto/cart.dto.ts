import { IsUUID, IsInt, Min, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'ID of the product variant' })
  @IsUUID()
  @IsNotEmpty()
  variantId!: string;

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
