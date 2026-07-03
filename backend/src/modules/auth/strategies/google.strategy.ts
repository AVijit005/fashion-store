import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

/**
 * Google OAuth 2.0 strategy — Phase 5 (audit item 5.1).
 *
 * Flow:
 *   1. Frontend redirects to GET /auth/google → passport redirects to Google.
 *   2. Google authenticates and redirects to GET /auth/google/callback?code=…
 *   3. Passport exchanges the code, calls `validate()` with the profile.
 *   4. `validate()` calls `authService.loginOrCreateFromGoogle()` which:
 *      - finds an existing user by email and links the googleId, OR
 *      - creates a new CUSTOMER user with a random password.
 *   5. AuthController sets the same httpOnly cookies + redirects to /account.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_CALLBACK_URL  (default: ${API_BASE_URL}/api/v1/auth/google/callback)
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ??
      `${configService.get<string>('API_BASE_URL') ?? 'http://localhost:3000'}/api/v1/auth/google/callback`;

    // The strategy silently disables itself when credentials are missing.
    // passport-google-oauth20 throws on construction with empty strings, so
    // we feed it placeholder values that will simply never be used (no
    // route will hit /auth/google without explicit user navigation).
    super({
      clientID: clientID ?? 'google-oauth-disabled',
      clientSecret: clientSecret ?? 'google-oauth-disabled',
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });

    if (!clientID || !clientSecret) {
      this.logger.warn(
        'Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing). ' +
          '/auth/google will throw if invoked.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      emails?: Array<{ value: string; verified?: boolean }>;
      displayName?: string;
      name?: { givenName?: string; familyName?: string };
      photos?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(new Error('Google profile did not return an email'), undefined);
    }
    try {
      const user = await this.authService.loginOrCreateFromGoogle({
        googleId: profile.id,
        email,
        name: profile.displayName ?? profile.name?.givenName ?? null,
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
