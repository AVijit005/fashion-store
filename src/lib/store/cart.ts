// Cart store — Zustand with persist middleware.
// Local state is the primary source of truth for UI (instant UX).
// Backend sync runs in the background for every add/update/remove/clear so that
// the backend cart is always populated when checkout is reached.
// Custom studio items (no variantId) are local-only and not synced to the backend.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cartApi } from "../api/cart";

export type CartItem = {
  id: string;
  /** Backend ProductVariant UUID — required for backend sync and checkout. */
  variantId?: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  mrp: number;
  size: string;
  color: string;
  qty: number;
  custom?: boolean;
};

type CartState = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  savings: () => number;
  count: () => number;
};

const keyFor = (i: { id: string; size: string; color: string }) => `${i.id}-${i.size}-${i.color}`;

// Fire-and-forget backend sync — never blocks the UI.
// Errors are logged but do not affect the local cart state.
function syncAdd(variantId: string, quantity: number) {
  cartApi
    .addItem(variantId, quantity)
    .catch((err) => console.error("[cart] Backend sync addItem failed:", err));
}

function syncUpdate(variantId: string, qty: number) {
  if (qty <= 0) {
    cartApi
      .removeItem(variantId)
      .catch((err) => console.error("[cart] Backend sync removeItem failed:", err));
  } else {
    cartApi
      .updateItem(variantId, qty)
      .catch((err) => console.error("[cart] Backend sync updateItem failed:", err));
  }
}

function syncRemove(variantId: string) {
  cartApi
    .removeItem(variantId)
    .catch((err) => console.error("[cart] Backend sync removeItem failed:", err));
}

function syncClear() {
  cartApi.clearCart().catch((err) => console.error("[cart] Backend sync clearCart failed:", err));
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      setOpen: (v) => set({ open: v }),

      add: (i) => {
        const qty = i.qty ?? 1;
        const k = keyFor(i);
        const existing = get().items.find((it) => keyFor(it) === k);

        if (existing) {
          set({
            items: get().items.map((it) => (keyFor(it) === k ? { ...it, qty: it.qty + qty } : it)),
            open: true,
          });
        } else {
          set({ items: [...get().items, { ...i, qty }], open: true });
        }

        // Sync to backend only for real product variants (not custom studio items)
        if (i.variantId) {
          syncAdd(i.variantId, qty);
        }
      },

      remove: (k) => {
        const item = get().items.find((it) => keyFor(it) === k);
        set({ items: get().items.filter((it) => keyFor(it) !== k) });

        if (item?.variantId) {
          syncRemove(item.variantId);
        }
      },

      setQty: (k, qty) => {
        const item = get().items.find((it) => keyFor(it) === k);
        set({
          items: get()
            .items.map((it) => (keyFor(it) === k ? { ...it, qty } : it))
            .filter((it) => it.qty > 0),
        });

        if (item?.variantId) {
          syncUpdate(item.variantId, qty);
        }
      },

      clear: () => {
        set({ items: [] });
        syncClear();
      },

      subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
      savings: () => get().items.reduce((s, i) => s + (i.mrp - i.price) * i.qty, 0),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),
    {
      name: "ink-cart",
      // Don't persist drawer-open state — avoids drawer popping on reload
      // and prevents SSR/CSR mismatches.
      partialize: (s) => ({ items: s.items }) as CartState,
    },
  ),
);

export const itemKey = keyFor;
