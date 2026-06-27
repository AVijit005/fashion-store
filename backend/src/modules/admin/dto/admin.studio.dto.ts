import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RejectRequestDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RequestRevisionDto {
  @IsString()
  @IsNotEmpty()
  notes!: string;
}
