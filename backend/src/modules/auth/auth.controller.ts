import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CsrfService } from '../../common/guards/csrf.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/reset-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the XSRF-TOKEN cookie for CSRF protection' })
  @ApiResponse({ status: 200, description: 'CSRF cookie set' })
  async getCsrf(@Res({ passthrough: true }) res: Response) {
    this.setXsrfTokenCookie(res, this.csrfService.generateToken());
    return { message: 'CSRF cookie set' };
  }

  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(signUpDto);
    this.setXsrfTokenCookie(res, this.csrfService.generateToken());
    return result;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current logged in user details' })
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Log in with credentials' })
  @ApiResponse({ status: 200, description: 'Login successful, sets httpOnly auth cookies' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim(); // Clean proxy chains
    const userAgent = req.headers['user-agent'];

    const tokens = await this.authService.login(loginDto, ipAddress, userAgent);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    this.setAccessTokenCookie(res, tokens.accessToken);
    this.setXsrfTokenCookie(res, this.csrfService.generateToken());

    return { user: tokens.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Rotate tokens using refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim();
    const userAgent = req.headers['user-agent'];

    const tokens = await this.authService.refresh(refreshToken, ipAddress, userAgent);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    this.setAccessTokenCookie(res, tokens.accessToken);

    return { message: 'Token rotated successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and invalidate session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const rawIp = req.ip || req.headers['x-forwarded-for']?.toString();
    const ipAddress = rawIp?.split(',')[0]?.trim();

    if (refreshToken) {
      await this.authService.logout(refreshToken, ipAddress);
    }
    this.clearRefreshTokenCookie(res);
    this.clearAccessTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  // -------- Email verification --------

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify an email address using a token from the welcome email' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(this.authService.hashToken(dto.token));
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  // 1 request per hour per IP — matches our email quota & prevents
  // spam-triggered verification emails.
  @Throttle({ default: { limit: 1, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Re-send the verification email (rate-limited)' })
  async resendVerification(@Body() dto: ForgotPasswordDto) {
    // Re-uses ForgotPasswordDto (just `{ email }`); semantically separate.
    await this.authService.resendVerificationEmail(dto.email);
    return { message: 'If the account exists, a verification email has been sent.' };
  }

  // -------- Password reset --------

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  // 3 requests per hour per IP — generous enough for typos, tight
  // enough to make email flooding impractical.
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Request a password-reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    // Always return the same response — don't leak account presence.
    return { message: 'If the account exists, a password-reset email has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password updated successfully. Please sign in with your new password.' };
  }

  // -------- Cookie helpers --------

  private setRefreshTokenCookie(res: Response, token: string) {
    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      path: '/api/v1/auth/refresh',
      sameSite: 'lax',
      maxAge: expiryDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      expires: new Date(0),
    });
  }

  private setAccessTokenCookie(res: Response, token: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
  }

  private clearAccessTokenCookie(res: Response) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('access_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      expires: new Date(0),
    });
  }

  private setXsrfTokenCookie(res: Response, token: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}
