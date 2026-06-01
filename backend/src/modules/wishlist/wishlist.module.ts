import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, PrismaService],
  exports: [WishlistService]
})
export class WishlistModule {}
