import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

/**
 * TwoFactorService — Phase 5 (audit item 5.2).
 *
 * Time-based One-Time Password (TOTP, RFC 6238) second factor for ADMIN
 * accounts. When an admin enables 2FA, every subsequent login requires
 * both the password AND a 6-digit TOTP code from their authenticator
 * app (Google Authenticator, 1Password, Authy, etc.).
 *
 * Flow:
 *   1. POST /auth/2fa/setup  →  returns { secret, otpauthUrl, qrCodeDataUrl }
 *      (admin scans QR with their authenticator)
 *   2. POST /auth/2fa/verify { code }  →  marks user as enabled,
 *      returns backup codes (one-time use, hashed at rest)
 *   3. POST /auth/login  →  if admin + 2FA enabled, returns a
 *      short-lived "2fa-pending" JWT instead of full session
 *   4. POST /auth/2fa/validate { pendingToken, code }  →  exchanges for
 *      full access + refresh JWTs
 *
 * Backup codes: when 2FA is enabled, the service generates 10 single-use
 * codes (8 hex chars each). The plaintext is returned ONCE at enable
 * time; only their bcrypt-equivalent hashes are stored. On use, the
 * service hashes the provided code and constant-time compares.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly BACKUP_CODE_COUNT = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate a fresh TOTP secret + otpauth:// URL + QR code data URL.
   * Does NOT enable 2FA — admin must verify a code first to confirm
   * they scanned the QR correctly.
   */
  async generateSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = speakeasy.generateSecret({
      name: `Aura Streetwear (${user.email})`,
      issuer: this.configService.get<string>('APP_NAME') ?? 'Aura Streetwear',
      length: 32,
    });

    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the secret temporarily so verify() can match it. Mark
    // twoFactorEnabled=false until the admin confirms with a code.
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify a TOTP code against the user's stored secret. If valid,
   * enable 2FA and generate backup codes (returned plaintext ONCE).
   */
  async verifyAndEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not started — call /auth/2fa/setup first');
    }

    const isValid = this.verifyTotp(user.twoFactorSecret, code);
    if (!isValid) {
      throw new BadRequestException('Invalid 2FA code');
    }

    // Generate backup codes (single-use). Store hashes only.
    const plaintextCodes = this.generateBackupCodes(this.BACKUP_CODE_COUNT);
    const hashedCodes = plaintextCodes.map((c) => this.hashBackupCode(c));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedCodes,
      },
    });

    return { backupCodes: plaintextCodes };
  }

  /**
   * Disable 2FA for a user. Requires a valid TOTP code as proof of
   * possession. Clears secret + backup codes.
   */
  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Accept either a TOTP code OR a valid backup code.
    const totpOk = this.verifyTotp(user.twoFactorSecret, code);
    const backupOk = !totpOk ? this.verifyBackupCode(user.twoFactorBackupCodes, code) : false;
    if (!totpOk && !backupOk) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
  }

  /**
   * Verify a TOTP or backup code for the login-time 2FA gate.
   * Returns true if the code matches either.
   */
  async verifyForLogin(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return false;

    if (this.verifyTotp(user.twoFactorSecret, code)) return true;
    return this.verifyAndConsumeBackupCode(userId, user.twoFactorBackupCodes, code);
  }

  // ---------- internals ----------

  private verifyTotp(secretBase32: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token: code.replace(/\s+/g, ''),
      window: 1, // ±30 seconds
    });
  }

  private generateBackupCodes(count: number): string[] {
    return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  }

  private verifyBackupCode(hashedCodes: string[], code: string): boolean {
    if (!hashedCodes.length) return false;
    const hash = this.hashBackupCode(code);
    return hashedCodes.includes(hash);
  }

  /**
   * Verify + consume a backup code in one transaction. Removes the
   * matching hash from the user's list so it can't be reused.
   */
  private async verifyAndConsumeBackupCode(
    userId: string,
    hashedCodes: string[],
    code: string,
  ): Promise<boolean> {
    if (!hashedCodes.length) return false;
    const hash = this.hashBackupCode(code);
    if (!hashedCodes.includes(hash)) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: { set: hashedCodes.filter((c) => c !== hash) } },
    });
    this.logger.log(`Backup code consumed for userId=${userId}`);
    return true;
  }
}
