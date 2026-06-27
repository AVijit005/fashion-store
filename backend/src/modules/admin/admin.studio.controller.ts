import { Controller, Post, Param, Body, UseGuards, Get, ParseUUIDPipe } from '@nestjs/common';
import { RejectRequestDto, RequestRevisionDto } from './dto/admin.studio.dto';
import { AdminStudioService } from './admin.studio.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/studio')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStudioController {
  constructor(private readonly studioService: AdminStudioService) {}

  @Get()
  async getSubmissions() {
    return this.studioService.getSubmissions();
  }

  @Post(':id/approve')
  async approveRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.studioService.updateStatus(id, 'APPROVED');
  }

  @Post(':id/reject')
  async rejectRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRequestDto) {
    return this.studioService.updateStatus(id, 'REJECTED', dto.reason);
  }

  @Post(':id/revise')
  async requestRevision(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestRevisionDto) {
    return this.studioService.updateStatus(id, 'UNDER_REVIEW', dto.notes);
  }
}
