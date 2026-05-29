import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, Query } from '@nestjs/common';
import { CreatorTemplateService } from './creator-template.service';
import { CreateCreatorTemplateDto, UpdateCreatorTemplateDto } from './dto/creator-template.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role, TemplateStatus } from '@prisma/client';

@ApiTags('Creator Templates')
@ApiBearerAuth()
@Controller('studio/templates')
export class CreatorTemplateController {
  constructor(private readonly templateService: CreatorTemplateService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new template (Creator/Admin only)' })
  create(@Req() req: any, @Body() createDto: CreateCreatorTemplateDto) {
    return this.templateService.create(req.user.id, createDto);
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List all templates. Admins/Creators see all, Customers see PUBLISHED only.',
  })
  @ApiQuery({ name: 'status', enum: TemplateStatus, required: false })
  findAll(@Req() req: any, @Query('status') status?: TemplateStatus) {
    // Customers can only see published templates
    const finalStatus = req.user.role === Role.CUSTOMER ? TemplateStatus.PUBLISHED : status;
    return this.templateService.findAll(finalStatus);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific template' })
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a template (Owner/Admin only)' })
  update(@Req() req: any, @Param('id') id: string, @Body() updateDto: UpdateCreatorTemplateDto) {
    return this.templateService.update(req.user.id, req.user.role, id, updateDto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a published template to a user design' })
  cloneToDesign(@Req() req: any, @Param('id') id: string) {
    return this.templateService.cloneToDesign(req.user.id, id);
  }
}
