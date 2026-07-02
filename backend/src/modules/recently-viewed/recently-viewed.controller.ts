import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RecentlyViewedService } from "./recently-viewed.service";
import { MergeRecentlyViewedDto, TrackViewDto } from "./dto/track-view.dto";

interface AuthenticatedUser {
  id: string;
}

@Controller("recently-viewed")
@UseGuards(AuthGuard)
export class RecentlyViewedController {
  constructor(private readonly recentlyViewed: RecentlyViewedService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("limit") limit?: string) {
    return this.recentlyViewed.list(user.id, limit ? Number(limit) : 12);
  }

  @Post("track")
  @HttpCode(204)
  async track(@CurrentUser() user: AuthenticatedUser, @Body() dto: TrackViewDto) {
    await this.recentlyViewed.track(user.id, dto.productId);
  }

  @Post("merge")
  @HttpCode(200)
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergeRecentlyViewedDto,
  ) {
    return this.recentlyViewed.mergeAnonymousViews(user.id, dto.productIds);
  }

  @Delete()
  @HttpCode(204)
  async clear(@CurrentUser() user: AuthenticatedUser) {
    await this.recentlyViewed.clear(user.id);
  }
}
