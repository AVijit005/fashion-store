import { Module } from '@nestjs/common';
import { ContactController, AdminContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PrismaModule } from '../../config/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
