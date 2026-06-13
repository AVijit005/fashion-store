import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, CreateAddressDto, UpdateAddressDto, UpdatePreferencesDto } from './dto/users.dto';
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
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    
    const updatedUser = await this.usersService.update(req.user.id, updateProfileDto);
    const { passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  async updatePreferences(@Req() req: any, @Body() body: UpdatePreferencesDto) {
    const user = await this.prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: body as any },
    });
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'Get all saved addresses' })
  async getAddresses(@Req() req: any) {
    return this.prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Add a new shipping address' })
  async addAddress(@Req() req: any, @Body() createDto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (createDto.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      const count = await tx.address.count({ where: { userId: req.user.id } });
      const isDefault = createDto.isDefault || count === 0;

      return tx.address.create({
        data: {
          street: createDto.street,
          city: createDto.city,
          state: createDto.state,
          postalCode: createDto.zip,
          country: createDto.country,
          isDefault,
          userId: req.user.id,
        },
      });
    });
  }

  @Put('me/addresses/:id')
  @ApiOperation({ summary: 'Update an address' })
  async updateAddress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateAddressDto,
  ) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!address) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      if (updateDto.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      const data: any = {};
      if (updateDto.street !== undefined) data.street = updateDto.street;
      if (updateDto.city !== undefined) data.city = updateDto.city;
      if (updateDto.state !== undefined) data.state = updateDto.state;
      if (updateDto.zip !== undefined) data.postalCode = updateDto.zip;
      if (updateDto.country !== undefined) data.country = updateDto.country;
      if (updateDto.isDefault !== undefined) data.isDefault = updateDto.isDefault;

      await tx.address.updateMany({
        where: { id, userId: req.user.id },
        data,
      });
      return tx.address.findUnique({ where: { id } });
    });
  }

  @Delete('me/addresses/:id')
  @ApiOperation({ summary: 'Delete an address' })
  async deleteAddress(@Req() req: any, @Param('id') id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!address) throw new NotFoundException('Address not found');

    await this.prisma.address.deleteMany({ where: { id, userId: req.user.id } });
    return { success: true };
  }
}
