import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SearchService } from './search.service';
import { PostgresSearchService } from './postgres-search.service';

import { AuthModule } from '../auth/auth.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [AuthModule, ReviewsModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: SearchService,
      useClass: PostgresSearchService,
    },
  ],
  exports: [CatalogService, SearchService],
})
export class CatalogModule {}
