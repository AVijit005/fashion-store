import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../config/prisma.service';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

interface AuthenticatedUser {
  id: string;
  role: string;
}

@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const product = await this.resolveProduct(slug);
    return this.reviews.listForProduct(product.id, Number(limit ?? 20), Number(offset ?? 0));
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const product = await this.resolveProduct(slug);
    return this.reviews.create(product.id, user.id, dto);
  }

  private async resolveProduct(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}

@Controller('admin/reviews')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    await this.reviews.approve(id);
    return { id, status: 'APPROVED' };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    await this.reviews.reject(id);
    return { id, status: 'REJECTED' };
  }
}
