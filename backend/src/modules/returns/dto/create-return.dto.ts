import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReturnDto {
  @IsUUID()
  orderItemId!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
