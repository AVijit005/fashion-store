import { Module } from '@nestjs/common';
import { StudioDesignService } from './studio-design.service';
import { StudioDesignController } from './studio-design.controller';
import { CreatorTemplateService } from './creator-template.service';
import { CreatorTemplateController } from './creator-template.controller';
import { StudioSubmissionService } from './studio-submission.service';
import { StudioSubmissionController } from './studio-submission.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StudioDesignController, CreatorTemplateController, StudioSubmissionController],
  providers: [StudioDesignService, CreatorTemplateService, StudioSubmissionService],
})
export class StudioModule {}
