import { apiClient } from "./client";

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string;
  mediaUrls: string[];
  createdAt: string;
  userName: string;
}

export interface ReviewsListResponse {
  items: ReviewDto[];
  average: number;
  count: number;
}

export const reviewsApi = {
  /**
   * Fetch reviews for a product by slug. Returns the full list (paginated)
   * plus the aggregate {average, count}.
   */
  list: (slug: string, limit = 20, offset = 0) =>
    apiClient.get<ReviewsListResponse>(`/products/${slug}/reviews`, { limit, offset }),

  /**
   * Submit a review. Backend enforces the verified-buyer gate (must own a
   * DELIVERED order containing the product). Throws 403 if not eligible,
   * 409 if already reviewed.
   */
  create: (slug: string, body: { rating: number; comment: string; mediaUrls?: string[] }) =>
    apiClient.post<{ id: string }>(`/products/${slug}/reviews`, body),
};
