import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address associated with the account' })
  @IsString()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use reset token from the password-reset email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @ApiProperty({
    example: 'MyNewStr0ng!Passw0rd',
    description: '12-128 chars, must include uppercase, lowercase, digit, and symbol',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password is too long (max 128 characters)' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one symbol' })
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Single-use verification token from the welcome email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;
}

export class ResendVerificationDto {
  // Body is empty — the email comes from the authenticated user. If the
  // route is also exposed unauthenticated, accept an optional email for
  // re-send, but the rate limit (1/hr) is what really protects us.
}
