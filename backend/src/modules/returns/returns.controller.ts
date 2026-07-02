import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReturnsService } from './returns.service';
import {
  CreateReturnDto,
  ReviewReturnDto,
  InitiateRefundDto,
} from './dto';

interface AuthenticatedUser {
  id: string;
  role: string;
}

// User-facing endpoints
@Controller('returns')
@UseGuards(AuthGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReturnDto) {
    return this.returns.createForUser(user.id, dto);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.returns.listForUser(user.id);
  }
}

// Admin endpoints
@Controller('admin/returns')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list() {
    return this.returns.listAllForAdmin();
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewReturnDto,
  ) {
    return this.returns.review(id, user.id, dto);
  }

  @Patch(':id/received')
  received(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.returns.markReceived(id, user.id);
  }

  @Post(':id/refund')
  refund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateRefundDto,
  ) {
    return this.returns.initiateRefund(id, user.id, dto);
  }

  @Patch(':id/refunded')
  refunded(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.returns.markRefunded(id, user.id);
  }
}
