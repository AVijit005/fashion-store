import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminCatalogService } from './admin.catalog.service';
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
  async getProducts() {
    return this.catalogService.getProducts();
  }

  @Post('products')
  async createProduct(@Body() data: any) {
    return this.catalogService.createProduct(data);
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() data: any) {
    return this.catalogService.updateProduct(id, data);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }
}
