import { apiClient } from "./client";

/**
 * Phase 3 (audit item 3.1): restock-notification API client.
 *
 * Anonymous users can subscribe with just their email + a variantId.
 * The backend dedups on (variantId, email) so repeated submissions are
 * idempotent. Throttled server-side to 3 req/min per IP.
 */
export const restockNotificationsApi = {
  subscribe: (slug: string, body: { variantId: string; email: string }) =>
    apiClient.post<{ subscribed: true; variantId: string; email: string }>(
      `/products/${slug}/notify-restock`,
      body,
    ),
};
