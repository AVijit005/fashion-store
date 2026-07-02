import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  // We do NOT enforce the new password policy at the login boundary —
  // users with passwords created under the old (lenient) policy must
  // still be able to log in. Policy is enforced on signup + reset.
  @ApiProperty({ example: 'password' })
  @IsString()
  @MinLength(1)
  password!: string;
}
