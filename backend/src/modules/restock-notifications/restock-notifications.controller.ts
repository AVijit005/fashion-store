import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RestockNotificationsService } from './restock-notifications.service';
import { SubscribeRestockDto } from './dto/subscribe-restock.dto';
import { PrismaService } from '../../config/prisma.service';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Public endpoint — anyone can subscribe with their email.
// Rate-limited to 3/min per IP to prevent signup spam / email enumeration.
@Controller('products/:slug/notify-restock')
export class RestockNotificationsController {
  constructor(
    private readonly restock: RestockNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  async subscribe(@Param('slug') slug: string, @Body() dto: SubscribeRestockDto) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        variants: {
          where: { id: dto.variantId, isDeleted: false },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!product || product.variants.length === 0) {
      throw new NotFoundException('Product variant not found');
    }
    const result = await this.restock.subscribe(dto.variantId, dto.email);
    return {
      subscribed: true,
      variantId: result.variantId,
      email: result.email,
    };
  }
}

// Admin endpoint.
@Controller('admin/restock-notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminRestockNotificationsController {
  constructor(private readonly restock: RestockNotificationsService) {}

  @Get()
  list(@Query('variantId') variantId?: string) {
    // We delegate to the service for the variant-filtered case so the
    // list endpoint stays a thin wrapper.
    return variantId ? this.restock['findPendingByVariant'](variantId) : this.restock.listAll();
  }

  @Delete(':variantId')
  @HttpCode(200)
  reset(@Param('variantId') variantId: string) {
    return this.restock.clearNotified(variantId);
  }
}
