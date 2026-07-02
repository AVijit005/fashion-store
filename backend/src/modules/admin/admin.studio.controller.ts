import { Controller, Post, Param, Body, UseGuards, Get, ParseUUIDPipe, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { RejectRequestDto, RequestRevisionDto } from './dto/admin.studio.dto';
import { AdminStudioService } from './admin.studio.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/studio')
@Throttle({ default: { limit: 60, ttl: 60000 } })
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStudioController {
  constructor(private readonly studioService: AdminStudioService) {}

  @Get()
  async getSubmissions() {
    return this.studioService.getSubmissions();
  }

  @Post(':id/approve')
  async approveRequest(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    return this.studioService.updateStatus(id, 'APPROVED', userId);
  }

  @Post(':id/reject')
  async rejectRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRequestDto, @Req() req: Request) {
    const userId = (req as any).user.id;
    return this.studioService.updateStatus(id, 'REJECTED', userId, dto.reason);
  }

  @Post(':id/revise')
  async requestRevision(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestRevisionDto, @Req() req: Request) {
    const userId = (req as any).user.id;
    return this.studioService.updateStatus(id, 'UNDER_REVIEW', userId, dto.notes);
  }
}
