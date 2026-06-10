// Cart store — Zustand with persist middleware.
// Local state is the primary source of truth for UI (instant UX).
// Backend sync runs in the background for every add/update/remove/clear so that
// the backend cart is always populated when checkout is reached.
// Custom studio items (no variantId) are local-only and not synced to the backend.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
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
  maxQty?: number;
  custom?: boolean;
  customData?: any;
};

type CartState = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  setItems: (items: CartItem[]) => void;
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
const syncQueue: { task: () => Promise<void>, rollback?: () => void }[] = [];
let isSyncing = false;

async function processQueue() {
  if (isSyncing || syncQueue.length === 0) return;
  isSyncing = true;
  while (syncQueue.length > 0) {
    const item = syncQueue.shift();
    if (item) {
      try {
        await item.task();
      } catch (err) {
        console.error("[cart] Backend sync failed:", err);
        const msg = err instanceof Error ? err.message : "Failed to update cart";
        toast.error(msg);
        if (item.rollback) item.rollback();
      }
    }
  }
  isSyncing = false;
}

function enqueueSync(task: () => Promise<void>, rollback?: () => void) {
  syncQueue.push({ task, rollback });
  processQueue();
}

function syncAdd(itemId: string, quantity: number, customData?: any, rollback?: () => void) {
  enqueueSync(() => cartApi.addItem(itemId, quantity, customData).then(() => {}), rollback);
}

function syncUpdate(itemId: string, qty: number, rollback?: () => void) {
  if (qty <= 0) {
    enqueueSync(() => cartApi.removeItem(itemId).then(() => {}), rollback);
  } else {
    enqueueSync(() => cartApi.updateItem(itemId, qty).then(() => {}), rollback);
  }
}

function syncRemove(itemId: string, rollback?: () => void) {
  enqueueSync(() => cartApi.removeItem(itemId).then(() => {}), rollback);
}

function syncClear(rollback?: () => void) {
  enqueueSync(() => cartApi.clearCart().then(() => {}), rollback);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      setOpen: (v) => set({ open: v }),
      setItems: (items) => set({ items }),

      add: (i) => {
        const previousItems = get().items;
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

        // Sync to backend with rollback closure
        syncAdd(i.variantId || i.id, qty, i.customData, () => set({ items: previousItems }));
      },

      remove: (k) => {
        const previousItems = get().items;
        const item = get().items.find((it) => keyFor(it) === k);
        set({ items: get().items.filter((it) => keyFor(it) !== k) });

        syncRemove(item?.variantId || k, () => set({ items: previousItems }));
      },

      setQty: (k, qty) => {
        const previousItems = get().items;
        const item = get().items.find((it) => keyFor(it) === k);
        if (item && item.maxQty !== undefined && qty > item.maxQty) {
          toast.error(`Only ${item.maxQty} left in stock`);
          qty = item.maxQty;
        }
        
        set({
          items: get()
            .items.map((it) => (keyFor(it) === k ? { ...it, qty } : it))
            .filter((it) => it.qty > 0),
        });

        if (item) {
          syncUpdate(item.variantId || k, qty, () => set({ items: previousItems }));
        }
      },

      clear: () => {
        const previousItems = get().items;
        set({ items: [] });
        syncClear(() => set({ items: previousItems }));
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

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ink-cart") {
      useCart.persist.rehydrate();
    }
  });
}
