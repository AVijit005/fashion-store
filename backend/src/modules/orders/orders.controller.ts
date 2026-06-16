import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  BadRequestException,
  UnauthorizedException,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CheckoutDto, VerifyPaymentDto, ApplyCouponDto } from './dto/orders.dto';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Extend express Request to include NestJS rawBody buffer
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

interface RequestUser {
  id: string;
  role: string;
}

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Initialize checkout and create gateway order' })
  async checkout(@Body() dto: CheckoutDto, @CurrentUser() user?: RequestUser) {
    if (!user?.id && !dto.guestSessionId) {
      throw new BadRequestException(
        'Session identifier (guestSessionId) is required for guest checkout',
      );
    }
    return this.ordersService.checkout(dto, user?.id);
  }

  @Post('apply-coupon')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate and calculate discount for a coupon code' })
  async applyCoupon(@Body() dto: ApplyCouponDto) {
    return this.ordersService.applyCoupon(dto.code, dto.subtotal);
  }

  @Post('verify-payment')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Verify payment signature after gateway response' })
  async verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @Headers('x-guest-token') guestToken?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.ordersService.verifyPayment(dto, user?.id, guestToken);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay webhook listener for payment capture' })
  async webhook(@Req() req: RawBodyRequest, @Headers('x-razorpay-signature') signature?: string) {
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Webhook signature header missing or invalid format');
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!rawBody || rawBody.trim() === '') {
      throw new BadRequestException('Empty webhook body');
    }

    try {
      JSON.parse(rawBody); // Ensure it is valid JSON before passing to service
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    return this.ordersService.handleWebhook(rawBody, signature);
  }

  @Post(':id/retry-payment')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Retry payment for a failed or pending order' })
  async retryPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-guest-token') guestToken?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.ordersService.retryPayment(id, user?.id, guestToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get order history for authenticated user' })
  async getMyOrders(
    @CurrentUser() user: RequestUser,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    const safeLimit = Math.max(1, Math.min(100, limit || 10));
    const safeOffset = Math.max(0, offset || 0);
    return this.ordersService.getMyOrders(user.id, safeLimit, safeOffset);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get details of a single order by ID' })
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-guest-token') guestToken?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.ordersService.getOrderById(id, user?.id, guestToken);
  }
}
