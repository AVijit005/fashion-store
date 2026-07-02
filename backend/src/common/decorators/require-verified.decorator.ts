import { SetMetadata } from '@nestjs/common';
import { REQUIRE_VERIFIED_KEY } from '../guards/require-verified.guard';

/**
 * Mark a route handler (or entire controller) as requiring a verified
 * email address. Combined with RequireVerifiedGuard, requests from
 * unverified users get a 403 instead of silently succeeding.
 *
 * @example
 *   @Post('checkout')
 *   @UseGuards(OptionalAuthGuard, RequireVerifiedGuard)
 *   @RequireVerified()
 *   async checkout(...)
 */
export const RequireVerified = () => SetMetadata(REQUIRE_VERIFIED_KEY, true);
