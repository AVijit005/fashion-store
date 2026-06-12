import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminCustomersService } from './admin.customers.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin - Customers')
@ApiBearerAuth()
@Controller('admin/customers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers with computed stats' })
  async getCustomers(
    @Query('page') page = '1',
    @Query('limit') limit = '15',
    @Query('q') q?: string,
    @Query('segment') segment?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    return this.customersService.getCustomers(pageNum, limitNum, q, segment);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add an internal note to a customer' })
  async addNote(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    return this.customersService.addNote(id, note);
  }
}
