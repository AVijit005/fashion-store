import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Wishlist')
@Controller('wishlist')
@UseGuards(AuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated user wishlist' })
  async getWishlist(@CurrentUser() user: { id: string }) {
    return this.wishlistService.getWishlist(user.id);
  }

  @Post(':productId/toggle')
  @ApiOperation({ summary: 'Toggle product in wishlist' })
  async toggleWishlistItem(
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.wishlistService.toggleWishlistItem(user.id, productId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync local wishlist to backend' })
  async syncWishlist(@Body() body: { productIds: string[] }, @CurrentUser() user: { id: string }) {
    if (!body.productIds || !Array.isArray(body.productIds)) {
      return this.wishlistService.getWishlist(user.id);
    }
    return this.wishlistService.syncWishlist(user.id, body.productIds);
  }
}
