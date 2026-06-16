import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../config/prisma.service';
import * as argon2 from 'argon2';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be provided');
    process.exit(1);
  }

  const hashedPassword = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log(`Admin user ${admin.email} bootstrapped successfully.`);
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
