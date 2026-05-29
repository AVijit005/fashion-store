import { Controller, Get, Post, Body, Param, UseGuards, Req, Query, Patch } from '@nestjs/common';
import { StudioSubmissionService } from './studio-submission.service';
import { ResolveSubmissionDto } from './dto/studio-submission.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role, SubmissionStatus } from '@prisma/client';

@ApiTags('Studio Submissions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('studio/submissions')
export class StudioSubmissionController {
  constructor(private readonly submissionService: StudioSubmissionService) {}

  @Post('design/:designId')
  @ApiOperation({ summary: 'Submit a design for printing/approval' })
  submit(@Req() req: any, @Param('designId') designId: string, @Body('notes') notes?: string) {
    return this.submissionService.submitDesign(req.user.id, designId, notes);
  }

  // Admin routes below

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all submissions (Admin)' })
  @ApiQuery({ name: 'status', enum: SubmissionStatus, required: false })
  findAll(@Query('status') status?: SubmissionStatus) {
    return this.submissionService.listSubmissions(status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get submission details (Admin)' })
  findOne(@Param('id') id: string) {
    return this.submissionService.getSubmission(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/review')
  @ApiOperation({ summary: 'Place a submission under review (Admin)' })
  review(@Req() req: any, @Param('id') id: string) {
    return this.submissionService.reviewSubmission(req.user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Approve or reject a submission (Admin)' })
  resolve(@Req() req: any, @Param('id') id: string, @Body() dto: ResolveSubmissionDto) {
    return this.submissionService.resolveSubmission(req.user.id, id, dto);
  }
}
