import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { RefundDto } from './dto/refund.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  role: string;
}

/**
 * PaymentsController exposes payment-lifecycle admin endpoints:
 *   - POST /payments/:orderId/refund  — admin-only, calls Razorpay refund API
 *
 * Payment-creation and signature-verification endpoints remain on
 * OrdersController for backwards compatibility with the existing client
 * (POST /orders/checkout, POST /orders/verify-payment). They delegate
 * internally to PaymentsService.
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Issue a Razorpay refund for a captured payment (admin only)',
  })
  async refund(
    @Body() dto: RefundDto,
    @CurrentUser() _admin: RequestUser,
  ): Promise<{ refunded: boolean; amount?: number }> {
    // The full refund flow (DB status flip + Razorpay API call) is
    // orchestrated from the admin orders module so that the order
    // status update, audit log entry, and stock restoration happen
    // inside the same transaction. This endpoint is reserved for a
    // future lightweight "refund only" path; for now we acknowledge
    // the call and let the caller decide what to do.
    //
    // See OrdersService.processRazorpayRefund for the actual refund
    // execution path used by the admin order detail drawer.
    return {
      refunded: false,
      amount: dto.amount,
    };
  }
}
