import { Controller, Get, UseGuards } from '@nestjs/common';
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
  async getCustomers() {
    return this.customersService.getCustomers();
  }
}
