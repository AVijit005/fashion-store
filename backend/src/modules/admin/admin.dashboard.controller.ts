import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin.dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('kpis')
  async getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('activity')
  async getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
