import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AdminCatalogService } from './admin.catalog.service';
import { CreateProductDto, UpdateProductDto } from './dto/admin.catalog.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/catalog')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCatalogController {
  constructor(private readonly catalogService: AdminCatalogService) {}

  @Get('products')
  async getProducts(
    @Query('page') page = '1',
    @Query('limit') limit = '15',
    @Query('q') q?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    return this.catalogService.getProducts(pageNum, limitNum, q);
  }

  @Post('products')
  async createProduct(@Body() data: CreateProductDto) {
    return this.catalogService.createProduct(data);
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.catalogService.updateProduct(id, data);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }
}
