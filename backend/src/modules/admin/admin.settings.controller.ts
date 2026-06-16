import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminSettingsService } from './admin.settings.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/settings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() newSettings: any) {
    return this.settingsService.updateSettings(newSettings);
  }
}
