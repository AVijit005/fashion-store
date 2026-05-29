import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SearchService } from './search.service';
import { PostgresSearchService } from './postgres-search.service';

@Module({
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
