import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaModule } from './prisma.module';

/**
 * Global settings module — exposes SettingsService to every other module
 * without needing to re-import. Wired in app.module.ts.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
