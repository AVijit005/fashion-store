import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from '../auth/auth.service';
import { CsrfService } from '../../common/guards/csrf.service';
import { TwoFactorCodeDto, ValidateTwoFactorDto } from './dto/verify-2fa.dto';

interface AuthenticatedUser {
  id: string;
  role: string;
}

interface TwoFactorPendingPayload {
  sub: string;
  email: string;
  role: string;
  purpose: '2fa-pending';
}

@Controller('auth/2fa')
@UseGuards(AuthGuard)
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly csrfService: CsrfService,
  ) {}

  /**
   * Step 1: generate a fresh TOTP secret + otpauth URL + QR code data URL.
   * Does NOT enable 2FA yet — admin must verify a code from their
   * authenticator in step 2.
   */
  @Post('setup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.generateSecret(user.id);
  }

  /**
   * Step 2: verify a TOTP code from the authenticator app. Enables 2FA
   * on the user and returns 10 one-time backup codes (plaintext, shown
   * ONCE — only hashes are stored after this call).
   */
  @Post('verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactorService.verifyAndEnable(user.id, dto.code);
  }

  /**
   * Login-time step 2: client sends the short-lived 2fa-pending JWT
   * (issued by /auth/login for admins with 2FA enabled) + the TOTP
   * code. On success, returns full access + refresh cookies just like
   * a normal /auth/login.
   */
  @Post('validate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async validate(
    @Body() dto: ValidateTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Verify the 2fa-pending token (purpose-bound, short-lived).
    let payload: TwoFactorPendingPayload;
    try {
      payload = this.jwtService.verify(dto.pendingToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as TwoFactorPendingPayload;
    } catch {
      throw new Error('Invalid or expired 2FA session — please sign in again');
    }
    if (payload.purpose !== '2fa-pending') {
      throw new Error('Invalid 2FA session — please sign in again');
    }

    const ok = await this.twoFactorService.verifyForLogin(payload.sub, dto.code);
    if (!ok) throw new Error('Invalid 2FA code');

    const rawIp = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const userAgent = req.headers['user-agent'];
    const tokens = await this.authService.mintSessionForUser(
      payload.sub,
      payload.email,
      payload.role,
      rawIp,
      userAgent,
    );
    (this.authService as any).setRefreshTokenCookie?.(res, tokens.refreshToken);
    (this.authService as any).setAccessTokenCookie?.(res, tokens.accessToken);
    // The cookie helpers are private on AuthService; set via response
    // helpers below using the same cookie attributes.
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      path: '/api/v1/auth/refresh',
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: expiryDays * 24 * 60 * 60 * 1000,
    });
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('XSRF-TOKEN', this.csrfService.generateToken(), {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'strict',
      path: '/',
    });
    return { user: tokens.user };
  }

  /**
   * Disable 2FA. Requires a valid TOTP or backup code.
   */
  @Post('disable')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async disable(@CurrentUser() user: AuthenticatedUser, @Body() dto: TwoFactorCodeDto) {
    await this.twoFactorService.disable(user.id, dto.code);
    return { twoFactorEnabled: false };
  }
}
