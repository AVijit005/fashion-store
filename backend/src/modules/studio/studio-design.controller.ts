import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { StudioDesignService } from './studio-design.service';
import { CreateStudioDesignDto, UpdateStudioDesignDto } from './dto/studio-design.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Studio Designs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('studio/designs')
export class StudioDesignController {
  constructor(private readonly studioDesignService: StudioDesignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new studio design project' })
  create(@Req() req: any, @Body() createStudioDesignDto: CreateStudioDesignDto) {
    return this.studioDesignService.create(req.user.id, createStudioDesignDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all designs for the current user' })
  findAll(@Req() req: any) {
    return this.studioDesignService.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific design and its latest version' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.studioDesignService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a design (creates a new version if designJson is provided)' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateStudioDesignDto: UpdateStudioDesignDto,
  ) {
    return this.studioDesignService.update(req.user.id, id, updateStudioDesignDto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate an existing design into a new project' })
  duplicate(@Req() req: any, @Param('id') id: string) {
    return this.studioDesignService.duplicate(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a design' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.studioDesignService.remove(req.user.id, id);
  }

  @Post(':id/rollback')
  @ApiOperation({ summary: 'Rollback a design to a specific version number' })
  rollback(@Req() req: any, @Param('id') id: string, @Body('versionNumber') versionNumber: number) {
    return this.studioDesignService.rollback(req.user.id, id, versionNumber);
  }
}
