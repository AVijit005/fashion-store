import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Phase 5 (audit item 5.2): DTOs for the 2FA endpoints.
 *
 * The `code` field accepts either a 6-digit TOTP code (the usual case)
 * OR an 8-character hex backup code (no hyphens, uppercase). We don't
 * distinguish — verifyForLogin() tries TOTP first, then backup.
 */
export class TwoFactorCodeDto {
  @IsString()
  @Matches(/^(\d{6}|[A-F0-9]{8})$/i, {
    message: 'code must be a 6-digit TOTP or 8-character hex backup code',
  })
  code!: string;
}

/**
 * Login-time 2FA validation: client submits the short-lived 2fa-pending
 * token (issued by /auth/login when admin + 2FA enabled) + the TOTP code.
 */
export class ValidateTwoFactorDto extends TwoFactorCodeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  pendingToken!: string;
}
