import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto, MergeCartDto } from './dto/cart.dto';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  role: string;
}

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private getSessionOrUserId(
    user?: RequestUser,
    sessionId?: string,
  ): { userId?: string; sessionId?: string } {
    if (user?.id) {
      return { userId: user.id };
    }
    if (sessionId) {
      return { sessionId };
    }
    throw new BadRequestException(
      'Session identifier (x-cart-session-id header) is required for guests',
    );
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get current cart items with live pricing' })
  @ApiHeader({
    name: 'x-cart-session-id',
    required: false,
    description: 'Guest cart session ID (UUID)',
  })
  async getCart(
    @CurrentUser() user?: RequestUser,
    @Headers('x-cart-session-id') sessionId?: string,
  ) {
    const { userId, sessionId: sId } = this.getSessionOrUserId(user, sessionId);
    return this.cartService.getCart(userId, sId);
  }

  @Post('items')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Add product variant to cart' })
  @ApiHeader({
    name: 'x-cart-session-id',
    required: false,
    description: 'Guest cart session ID (UUID)',
  })
  async addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user?: RequestUser,
    @Headers('x-cart-session-id') sessionId?: string,
  ) {
    const { userId, sessionId: sId } = this.getSessionOrUserId(user, sessionId);
    return this.cartService.addItem(dto.variantId, dto.quantity, userId, sId);
  }

  @Patch('items/:variantId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiHeader({
    name: 'x-cart-session-id',
    required: false,
    description: 'Guest cart session ID (UUID)',
  })
  async updateItem(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user?: RequestUser,
    @Headers('x-cart-session-id') sessionId?: string,
  ) {
    const { userId, sessionId: sId } = this.getSessionOrUserId(user, sessionId);
    return this.cartService.updateItem(variantId, dto.quantity, userId, sId);
  }

  @Delete('items/:variantId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiHeader({
    name: 'x-cart-session-id',
    required: false,
    description: 'Guest cart session ID (UUID)',
  })
  async removeItem(
    @Param('variantId') variantId: string,
    @CurrentUser() user?: RequestUser,
    @Headers('x-cart-session-id') sessionId?: string,
  ) {
    const { userId, sessionId: sId } = this.getSessionOrUserId(user, sessionId);
    return this.cartService.removeItem(variantId, userId, sId);
  }

  @Delete()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Clear cart content' })
  @ApiHeader({
    name: 'x-cart-session-id',
    required: false,
    description: 'Guest cart session ID (UUID)',
  })
  async clearCart(
    @CurrentUser() user?: RequestUser,
    @Headers('x-cart-session-id') sessionId?: string,
  ) {
    const { userId, sessionId: sId } = this.getSessionOrUserId(user, sessionId);
    return this.cartService.clearCart(userId, sId);
  }

  @Post('merge')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Merge guest cart into authenticated user cart' })
  async mergeCart(@Body() dto: MergeCartDto, @CurrentUser() user: RequestUser) {
    return this.cartService.mergeCart(dto.guestSessionId, user.id);
  }
}
