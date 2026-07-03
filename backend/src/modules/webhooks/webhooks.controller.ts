import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * WebhooksController is the dedicated home for inbound webhook routes.
 * Currently only Razorpay is supported, but this module is structured
 * so additional providers (Stripe, PayPal) can be added as sibling
 * controllers without touching the rest of the codebase.
 *
 * The controller is mounted at `/webhooks` (not `/orders/webhook`)
 * because webhook paths are conventionally top-level so they can be
 * allowlisted at the reverse proxy without conflicting with API
 * versioning. The legacy `POST /orders/webhook` path is preserved
 * as a thin redirect in OrdersController so existing webhook URLs
 * configured in the Razorpay dashboard continue to work.
 */
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('razorpay')
  @SkipTransform()
  @ApiOperation({ summary: 'Razorpay webhook listener for payment capture' })
  async razorpay(@Req() req: RawBodyRequest, @Headers('x-razorpay-signature') signature?: string) {
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Webhook signature header missing or invalid format');
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!rawBody || rawBody.trim() === '') {
      throw new BadRequestException('Empty webhook body');
    }

    try {
      JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    return this.webhooksService.handleRazorpayWebhook(rawBody, signature);
  }
}
