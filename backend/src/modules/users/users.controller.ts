import {
  Controller,
  Get,
  Put,
  Body,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateAddressDto } from './dto/users.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and default address' })
  async getProfile(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { addresses: { where: { isDefault: true }, take: 1 } },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    
    // Omit sensitive data
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @Put('me')
  @ApiOperation({ summary: 'Update profile details' })
  async updateProfile(@Req() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    const user = await this.usersService.update(req.user.id, updateProfileDto);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @Put('me/address')
  @ApiOperation({ summary: 'Update or create default shipping address' })
  async updateAddress(@Req() req: any, @Body() updateAddressDto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      // Check if user has an address atomically within the transaction
      const existing = await tx.address.findFirst({
        where: { userId: req.user.id, isDefault: true },
      });

      if (existing) {
        return tx.address.update({
          where: { id: existing.id },
          data: updateAddressDto,
        });
      } else {
        return tx.address.create({
          data: {
            ...updateAddressDto,
            userId: req.user.id,
            isDefault: true,
          },
        });
      }
    });
  }
}
