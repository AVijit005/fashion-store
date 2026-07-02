import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Password policy enforced on signup and password reset:
 *   - 12 to 128 characters
 *   - at least one uppercase letter
 *   - at least one lowercase letter
 *   - at least one digit
 *   - at least one symbol (any non-alphanumeric)
 *
 * 12 chars + 4 character classes brings the effective entropy above
 * what zxcvbn considers acceptable for online-attack scenarios.
 */
export const PASSWORD_POLICY_MESSAGE =
  'Password must be 12-128 characters and include uppercase, lowercase, digit, and symbol';

export const IsStrongPassword = () => (target: object, propertyName: string) => {
  // Matches decorators are applied via decorators array below; this helper
  // is kept for clarity in case we want to swap to a single custom rule.
};

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'MyStr0ng!Passw0rd',
    description: '12-128 chars, must include uppercase, lowercase, digit, and symbol',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password is too long (max 128 characters)' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one symbol' })
  password!: string;

  @ApiProperty({ description: 'Guest token to link orders', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'Guest token is too long' })
  guestToken?: string;
}
