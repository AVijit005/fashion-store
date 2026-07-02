import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController, AdminReviewsController } from './reviews.controller';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
