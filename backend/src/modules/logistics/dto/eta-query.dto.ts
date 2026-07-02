import { IsString, Matches } from 'class-validator';

export class EtaQueryDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;
}
