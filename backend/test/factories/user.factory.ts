import { PrismaService } from '../../src/config/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

export interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  isVerified?: boolean;
}

let counter = 0;

export async function createUser(prisma: PrismaService, options: CreateUserOptions = {}) {
  counter++;
  const password = options.password ?? 'securePassword123!';
  return prisma.user.create({
    data: {
      email: options.email ?? `user-${counter}@example.com`,
      passwordHash: await argon2.hash(password),
      name: options.name ?? 'Test User',
      role: options.role ?? Role.CUSTOMER,
      isVerified: options.isVerified ?? true,
    },
  });
}
