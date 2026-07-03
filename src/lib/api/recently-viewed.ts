import { apiClient } from "./client";

export interface RecentlyViewedEntry {
  viewedAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    basePrice: number;
    mrp: number | null;
    mediaUrls: string[];
    tags: string[];
    variants: Array<{
      id: string;
      productId: string;
      sku: string;
      size: string;
      color: string;
      stockQuantity: number;
      priceOverride: number | null;
      thumbnailUrl: string | null;
      mediaUrls: string[];
    }>;
  };
}

/**
 * Phase 2 (audit item 2.1): API client for the server-side
 * recently-viewed list. Used when the user is logged in so the
 * list syncs across devices. Anonymous users keep using the
 * localStorage store (see src/lib/store/recently-viewed.ts).
 */
export const recentlyViewedApi = {
  /** Get the user's recent views (most recent first). */
  list: (limit = 12) => apiClient.get<RecentlyViewedEntry[]>("/recently-viewed", { limit }),

  /** Record a single product view. Fire-and-forget. */
  track: (productId: string) => apiClient.post<void>("/recently-viewed/track", { productId }),

  /**
   * Merge anonymous (localStorage) views into the backend on login.
   * Backend dedups by (userId, productId) and keeps the most recent
   * viewedAt; local-only ids are inserted.
   */
  merge: (productIds: string[]) =>
    apiClient.post<{ merged: number }>("/recently-viewed/merge", { productIds }),

  /** Clear all server-side views for the user. */
  clear: () => apiClient.delete<void>("/recently-viewed"),
};
