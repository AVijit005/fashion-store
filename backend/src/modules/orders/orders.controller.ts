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
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CheckoutDto, VerifyPaymentDto } from './dto/orders.dto';
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

  @Post('verify-payment')
  @ApiOperation({ summary: 'Verify payment signature after gateway response' })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.ordersService.verifyPayment(dto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay webhook listener for payment capture' })
  async webhook(@Req() req: RawBodyRequest, @Headers('x-razorpay-signature') signature?: string) {
    if (!signature) {
      throw new UnauthorizedException('Signature header missing');
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!rawBody) {
      throw new BadRequestException('Empty body');
    }

    return this.ordersService.handleWebhook(rawBody, signature);
  }

  @Get('my-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get order history for authenticated user' })
  async getMyOrders(@CurrentUser() user: RequestUser) {
    return this.ordersService.getMyOrders(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get details of a single order by ID' })
  async getOrderById(
    @Param('id') id: string,
    @Headers('x-guest-token') guestToken?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.ordersService.getOrderById(id, user?.id, guestToken);
  }
}
