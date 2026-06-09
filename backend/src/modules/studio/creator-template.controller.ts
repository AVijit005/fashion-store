import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, Query } from '@nestjs/common';
import { CreatorTemplateService } from './creator-template.service';
import { CreateCreatorTemplateDto, UpdateCreatorTemplateDto } from './dto/creator-template.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role, TemplateStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  role: string;
}

@ApiTags('Creator Templates')
@ApiBearerAuth()
@Controller('studio/templates')
export class CreatorTemplateController {
  constructor(private readonly templateService: CreatorTemplateService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new template (Creator/Admin only)' })
  create(@CurrentUser() user: RequestUser, @Body() createDto: CreateCreatorTemplateDto) {
    return this.templateService.create(user.id, createDto);
  }

  @UseGuards(OptionalAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List all templates. Admins/Creators see all, Customers/Guests see PUBLISHED only.',
  })
  @ApiQuery({ name: 'status', enum: TemplateStatus, required: false })
  findAll(@CurrentUser() user: RequestUser, @Query('status') status?: TemplateStatus) {
    const role = user?.role || Role.CUSTOMER;
    const userId = user?.id || '';
    // Customers and guests can only see published templates
    const finalStatus = role === Role.CUSTOMER ? TemplateStatus.PUBLISHED : status;
    return this.templateService.findAll(userId, role as Role, finalStatus);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific template' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.templateService.findOne(id, user.id, user.role as Role);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a template (Owner/Admin only)' })
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() updateDto: UpdateCreatorTemplateDto) {
    return this.templateService.update(user.id, user.role as Role, id, updateDto);
  }

  @UseGuards(AuthGuard)
  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a published template to a user design' })
  cloneToDesign(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.templateService.cloneToDesign(user.id, id);
  }
}
