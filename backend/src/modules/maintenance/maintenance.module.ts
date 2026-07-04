import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [StorageModule, EmailModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
