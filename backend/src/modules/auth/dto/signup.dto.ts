import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password is too long' })
  password!: string;

  @ApiProperty({ description: 'Guest token to link orders', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'Guest token is too long' })
  guestToken?: string;
}
