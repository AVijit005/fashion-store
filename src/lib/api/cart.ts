// Cart API module — bridges frontend cart store to backend cart APIs.
// All cart operations send the guest session ID as x-cart-session-id header.
// Authenticated requests also carry the JWT via apiClient's auto-attach logic.

import { apiClient } from "./client";

// ---------------------------------------------------------------------------
// Guest Session ID
// ---------------------------------------------------------------------------

/** Retrieves or lazily creates the guest cart session UUID stored in localStorage. */
export function getOrCreateCartSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("ink_cart_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ink_cart_session_id", id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Backend response types
// ---------------------------------------------------------------------------

export interface BackendCartItem {
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productTitle: string;
  productSlug: string;
  thumbnailUrl: string | null;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface BackendCart {
  items: BackendCartItem[];
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function cartHeaders(): Record<string, string> {
  const sessionId = getOrCreateCartSessionId();
  return sessionId ? { "x-cart-session-id": sessionId } : {};
}

// ---------------------------------------------------------------------------
// Cart API
// ---------------------------------------------------------------------------

export const cartApi = {
  /** Fetch the current cart from the backend (includes live stock/price). */
  async getCart(): Promise<BackendCart> {
    return apiClient.get<BackendCart>("/cart", undefined, {
      headers: cartHeaders(),
    });
  },

  /** Add an item to the backend cart. */
  async addItem(itemId: string, quantity: number, customData?: unknown): Promise<BackendCart> {
    return apiClient.post<BackendCart>(
      "/cart/items",
      { itemId, quantity, customData },
      { headers: cartHeaders() },
    );
  },

  /** Update the quantity of an existing cart item. */
  async updateItem(itemId: string, quantity: number): Promise<BackendCart> {
    return apiClient.patch<BackendCart>(
      `/cart/items/${itemId}`,
      { quantity },
      { headers: cartHeaders() },
    );
  },

  /** Remove an item from the backend cart. */
  async removeItem(itemId: string): Promise<BackendCart> {
    return apiClient.delete<BackendCart>(`/cart/items/${itemId}`, {
      headers: cartHeaders(),
    });
  },

  /** Clear all items from the backend cart. */
  async clearCart(): Promise<void> {
    await apiClient.delete<void>("/cart", { headers: cartHeaders() });
  },

  /**
   * Merge guest cart into the authenticated user's cart.
   * Call immediately after successful login.
   */
  async mergeCart(guestSessionId: string): Promise<BackendCart> {
    return apiClient.post<BackendCart>("/cart/merge", { guestSessionId });
  },
};
