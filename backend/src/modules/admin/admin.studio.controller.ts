import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AdminStudioService } from './admin.studio.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/studio')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStudioController {
  constructor(private readonly studioService: AdminStudioService) {}

  @Post(':id/approve')
  async approveRequest(@Param('id') id: string) {
    return this.studioService.updateStatus(id, 'APPROVED');
  }

  @Post(':id/reject')
  async rejectRequest(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.studioService.updateStatus(id, 'REJECTED', reason);
  }

  @Post(':id/revise')
  async requestRevision(@Param('id') id: string, @Body('notes') notes: string) {
    return this.studioService.updateStatus(id, 'UNDER_REVIEW', notes);
  }
}
