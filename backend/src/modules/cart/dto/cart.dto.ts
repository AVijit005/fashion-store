import {
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'isSafeJson', async: false })
export class IsSafeJsonConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'object' || value === null) return false;
    const str = JSON.stringify(value);
    if (str.length > 5000) return false; // 5KB limit

    // Depth check
    let depth = 0;
    let maxDepth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '{' || str[i] === '[') {
        depth++;
        if (depth > maxDepth) maxDepth = depth;
      } else if (str[i] === '}' || str[i] === ']') {
        depth--;
      }
    }
    return maxDepth <= 5;
  }
  defaultMessage() {
    return 'Custom data exceeds maximum allowed size or complexity (5KB, depth 5)';
  }
}

export class AddCartItemDto {
  @ApiProperty({ description: 'ID of the product variant or custom item' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ description: 'Custom design data', required: false })
  @IsOptional()
  @IsObject()
  @Validate(IsSafeJsonConstraint)
  customData?: Record<string, string | number | boolean>;

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
