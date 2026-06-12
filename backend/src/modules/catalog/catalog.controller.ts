import { Controller, Get, Query, Param, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { SearchService } from './search.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly searchService: SearchService,
  ) {}

  @Get('trigger-seed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Trigger DB seed natively' })
  async triggerSeed() {
    try {
      const result = await this.catalogService.runSeed();
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all product categories' })
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('collections')
  @ApiOperation({ summary: 'Get all active collections' })
  async getCollections() {
    return this.catalogService.getCollections();
  }

  @Get('products')
  @ApiOperation({ summary: 'Get product listing with optional filters' })
  @ApiQuery({ name: 'category', required: false, description: 'Category slug' })
  @ApiQuery({ name: 'collection', required: false, description: 'Collection slug' })
  @ApiQuery({ name: 'featured', required: false, description: 'Filter only featured products' })
  @ApiQuery({ name: 'limit', required: false, description: 'Pagination limit' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  async getProducts(
    @Query('category') categorySlug?: string,
    @Query('collection') collectionSlug?: string,
    @Query('featured') isFeaturedStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const isFeatured =
      isFeaturedStr === 'true' ? true : isFeaturedStr === 'false' ? false : undefined;
    const limit = this.parsePaginationValue(limitStr, 20, 1, 100, 'limit');
    const offset = this.parsePaginationValue(offsetStr, 0, 0, 10000, 'offset');

    return this.catalogService.getProducts({
      categorySlug,
      collectionSlug,
      isFeatured,
      limit,
      offset,
    });
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Get product details by slug' })
  async getProductBySlug(@Param('slug') slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }

  @Get('search')
  @ApiOperation({ summary: 'Typo-tolerant product search' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'collection', required: false, description: 'Filter by collection ID' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async searchProducts(
    @Query('q') query: string,
    @Query('category') categoryId?: string,
    @Query('collection') collectionId?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    if (!query || !query.trim()) {
      throw new BadRequestException('Search query is required');
    }
    const limit = this.parsePaginationValue(limitStr, 20, 1, 50, 'limit');
    const offset = this.parsePaginationValue(offsetStr, 0, 0, 10000, 'offset');

    return this.searchService.search(query, {
      limit,
      offset,
      categoryId,
      collectionId,
    });
  }

  @Get('drops')
  @ApiOperation({ summary: 'Get drops schedule' })
  async getActiveDrops() {
    return this.catalogService.getActiveDrops();
  }

  private parsePaginationValue(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number,
    name: string,
  ) {
    if (raw === undefined) {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException(`${name} must be an integer between ${min} and ${max}`);
    }
    return value;
  }
}
