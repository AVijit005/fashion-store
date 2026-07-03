import { IsString, IsUUID } from 'class-validator';

export class TrackViewDto {
  @IsUUID()
  productId!: string;
}

/**
 * Payload for merging localStorage items into the backend after login.
 * Accepts a list of product UUIDs the user has viewed anonymously.
 */
export class MergeRecentlyViewedDto {
  @IsString({ each: true })
  productIds!: string[];
}
