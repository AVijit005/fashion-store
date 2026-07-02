import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NewsletterService } from './newsletter.service';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.ACCEPTED)
  // 5/hr per IP — generous enough for retries / typos, tight enough
  // to prevent a single user from filling the queue with confirmation
  // emails.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Subscribe an email to the newsletter (double opt-in)',
  })
  async subscribe(@Body() body: { email?: string; source?: string }) {
    return this.newsletterService.requestSubscription({
      email: body?.email ?? '',
      source: (body?.source as 'welcome_modal' | 'footer' | 'other' | undefined) ?? 'other',
    });
  }

  @Get('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a newsletter subscription via email link' })
  async confirm(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Confirmation token is required');
    }
    return this.newsletterService.confirmSubscription(token);
  }
}
