import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { GoogleStrategy } from './strategies';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    EmailModule,
    BullModule.registerQueue({ name: 'email-queue' }),
    JwtModule.register({ global: true }),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    TwoFactorModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
  exports: [AuthService, JwtModule, TwoFactorModule],
})
export class AuthModule {}
