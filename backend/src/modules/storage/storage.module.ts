import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { AssetsController } from './assets.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AssetsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
