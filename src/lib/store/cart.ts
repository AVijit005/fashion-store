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
  customData?: any;
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

// Simple queue for backend sync to prevent race conditions
const syncQueue: (() => Promise<void>)[] = [];
let isSyncing = false;

async function processQueue() {
  if (isSyncing || syncQueue.length === 0) return;
  isSyncing = true;
  while (syncQueue.length > 0) {
    const task = syncQueue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error("[cart] Backend sync failed:", err);
      }
    }
  }
  isSyncing = false;
}

function enqueueSync(task: () => Promise<void>) {
  syncQueue.push(task);
  processQueue();
}

function syncAdd(itemId: string, quantity: number, customData?: any) {
  enqueueSync(() => cartApi.addItem(itemId, quantity, customData).then(() => {}));
}

function syncUpdate(itemId: string, qty: number) {
  if (qty <= 0) {
    enqueueSync(() => cartApi.removeItem(itemId).then(() => {}));
  } else {
    enqueueSync(() => cartApi.updateItem(itemId, qty).then(() => {}));
  }
}

function syncRemove(itemId: string) {
  enqueueSync(() => cartApi.removeItem(itemId).then(() => {}));
}

function syncClear() {
  enqueueSync(() => cartApi.clearCart().then(() => {}));
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

        // Sync to backend
        syncAdd(i.variantId || i.id, qty, i.customData);
      },

      remove: (k) => {
        const item = get().items.find((it) => keyFor(it) === k);
        set({ items: get().items.filter((it) => keyFor(it) !== k) });

        syncRemove(item?.variantId || k);
      },

      setQty: (k, qty) => {
        const item = get().items.find((it) => keyFor(it) === k);
        set({
          items: get()
            .items.map((it) => (keyFor(it) === k ? { ...it, qty } : it))
            .filter((it) => it.qty > 0),
        });

        if (item) {
          syncUpdate(item.variantId || k, qty);
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
