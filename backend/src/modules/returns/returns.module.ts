import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController, AdminReturnsController } from './returns.controller';
import { PrismaModule } from '../../config/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
