import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  sku!: string;

  @IsString()
  size!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsNumber()
  @Min(0)
  stock!: number;
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsUUID()
  dropId?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variantsData?: ProductVariantDto[];
}

export class UpdateProductDto extends CreateProductDto {}
