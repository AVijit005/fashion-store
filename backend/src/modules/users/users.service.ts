import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, passwordHash: string, role: Role = Role.CUSTOMER): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isDeleted: false },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
