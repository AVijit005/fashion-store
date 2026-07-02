import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminDropsService } from './admin.drops.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin - Drops')
@ApiBearerAuth()
@Controller('admin/drops')
@Throttle({ default: { limit: 60, ttl: 60000 } })
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDropsController {
  constructor(private readonly dropsService: AdminDropsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all drops with analytics' })
  async getDrops() {
    return this.dropsService.getDrops();
  }
}
