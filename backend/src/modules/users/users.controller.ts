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
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  UpdatePreferencesDto,
} from './dto/users.dto';
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Update profile details' })
  async updateProfile(@Req() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');

    const updatedUser = await this.usersService.update(req.user.id, updateProfileDto);
    const { passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }

  @Put('me/preferences')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  // ---------- Phase 9: GDPR data export + account deletion ----------

  @Get('me/export')
  @ApiOperation({
    summary: 'Export all data we hold for the current user (GDPR Art. 20)',
  })
  async exportMyData(@Req() req: any) {
    const userId = req.user.id;
    const [user, addresses, orders, reviews, wishlistItems, sessions, auditLogs] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          // Explicit field list — omit passwordHash, verificationToken,
          // passwordResetToken etc. even though they're never returned.
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
            preferences: true,
          },
        }),
        this.prisma.address.findMany({ where: { userId } }),
        this.prisma.order.findMany({
          where: { userId },
          include: {
            items: {
              include: {
                productVariant: {
                  include: { product: { select: { title: true, slug: true } } },
                },
              },
            },
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.review.findMany({ where: { userId } }),
        this.prisma.wishlistItem.findMany({
          where: { wishlist: { userId } },
          include: {
            product: { select: { title: true, slug: true } },
          },
        }),
        this.prisma.session.findMany({
          where: { userId },
          select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            isRevoked: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      addresses,
      orders,
      reviews,
      wishlist: wishlistItems,
      sessions,
      auditLogs,
    };
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Soft-delete the current user account (GDPR Art. 17). All sessions are revoked.',
  })
  async deleteMyAccount(@Req() req: any) {
    const userId = req.user.id;
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark the user as deleted. Keep the row so order records
      //    remain referentially intact for accounting / legal.
      await tx.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          // 2. Clear PII fields so the row no longer identifies the
          //    person. Email becomes a non-routable sentinel so unique
          //    constraint is preserved.
          email: `deleted-${userId}@deleted.invalid`,
          name: null,
          phone: null,
          // 3. Invalidate any outstanding auth tokens. Keeping the
          //    columns null is fine — signin/signup paths check
          //    isDeleted before granting access.
          verificationToken: null,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
      // 4. Revoke every session so a stolen refresh token can't keep
      //    acting after the user requested deletion.
      await tx.session.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });
    return {
      message:
        'Account deleted. Per our retention policy, order records are retained in anonymised form for tax / accounting compliance.',
    };
  }
}
