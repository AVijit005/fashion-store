// Cart store — Zustand with persist middleware.
// Local state is the primary source of truth for UI (instant UX).
// Backend sync runs in the background for every add/update/remove/clear so that
// the backend cart is always populated when checkout is reached.
// Custom studio items (no variantId) are local-only and not synced to the backend.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { cartApi } from "../api/cart";
import { apiClient } from "../api/client";

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
  couponCode: string | null;
  couponDiscount: number;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
};

const keyFor = (i: { id: string; size: string; color: string }) => `${i.id}-${i.size}-${i.color}`;

type SyncAction =
  | { type: "add"; itemId: string; quantity: number; customData?: any }
  | { type: "update"; itemId: string; qty: number }
  | { type: "remove"; itemId: string }
  | { type: "clear" };

interface SyncStore {
  queue: SyncAction[];
  isSyncing: boolean;
  enqueue: (action: SyncAction) => void;
  dequeue: () => SyncAction | undefined;
  setSyncing: (v: boolean) => void;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      setSyncing: (v) => set({ isSyncing: v }),
      enqueue: (action) => {
        set({ queue: [...get().queue, action] });
        processQueue();
      },
      dequeue: () => {
        const queue = get().queue;
        if (queue.length === 0) return undefined;
        const action = queue[0];
        set({ queue: queue.slice(1) });
        return action;
      },
    }),
    { name: "ink-cart-sync-queue", partialize: (state) => ({ queue: state.queue }) as SyncStore },
  ),
);

async function processQueue() {
  const store = useSyncStore.getState();
  if (store.isSyncing || store.queue.length === 0) return;
  store.setSyncing(true);

  try {
    while (useSyncStore.getState().queue.length > 0) {
      const action = useSyncStore.getState().queue[0];
      try {
        if (action.type === "add") {
          await cartApi.addItem(action.itemId, action.quantity, action.customData);
        } else if (action.type === "update") {
          await cartApi.updateItem(action.itemId, action.qty);
        } else if (action.type === "remove") {
          await cartApi.removeItem(action.itemId);
        } else if (action.type === "clear") {
          await cartApi.clearCart();
        }
        useSyncStore.getState().dequeue(); // only dequeue on success
      } catch (err: any) {
        console.error("[cart] Backend sync failed:", err);
        // If it's a 4xx error (permanent), dequeue to prevent blocking the queue forever
        if (err.status >= 400 && err.status < 500) {
          console.error("Permanent error, dropping from queue");
          useSyncStore.getState().dequeue();
        } else {
          toast.error("Failed to sync cart with server. Retrying soon.");
          break; // stop processing queue on failure
        }
      }
    }
  } finally {
    useSyncStore.getState().setSyncing(false);
  }
}

if (typeof window !== "undefined") {
  // Process queue on load in case there are pending items from last session
  setTimeout(processQueue, 1000);
}

function syncAdd(item: CartItem, quantity: number) {
  if (item.custom) return;
  useSyncStore.getState().enqueue({ type: "add", itemId: item.variantId || item.id, quantity, customData: item.customData });
}

function syncUpdate(item: CartItem, qty: number) {
  if (item.custom) return;
  if (qty <= 0) {
    useSyncStore.getState().enqueue({ type: "remove", itemId: item.variantId || item.id });
  } else {
    useSyncStore.getState().enqueue({ type: "update", itemId: item.variantId || item.id, qty });
  }
}

function syncRemove(item: CartItem) {
  if (item.custom) return;
  useSyncStore.getState().enqueue({ type: "remove", itemId: item.variantId || item.id });
}

function syncClear() {
  useSyncStore.getState().enqueue({ type: "clear" });
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      couponCode: null,
      couponDiscount: 0,
      setOpen: (v) => set({ open: v }),
      setItems: (items) => set({ items }),

      add: (i) => {
        let qty = i.qty ?? 1;
        const k = keyFor(i as CartItem);
        const existing = get().items.find((it) => keyFor(it) === k);

        if (existing) {
          if (existing.maxQty !== undefined && existing.qty + qty > existing.maxQty) {
             toast.error(`Only ${existing.maxQty} left in stock`);
             qty = existing.maxQty - existing.qty;
          }
          if (qty > 0) {
            set({
              items: get().items.map((it) => (keyFor(it) === k ? { ...it, qty: it.qty + qty } : it)),
              open: true,
              couponCode: null,
              couponDiscount: 0,
            });
            syncAdd(existing, qty);
          }
        } else {
           if (i.maxQty !== undefined && qty > i.maxQty) qty = i.maxQty;
           const newItem = { ...(i as CartItem), qty };
           set({ items: [...get().items, newItem], open: true, couponCode: null, couponDiscount: 0 });
           syncAdd(newItem, qty);
        }
      },

      remove: (k) => {
        const item = get().items.find((it) => keyFor(it) === k);
        set({ items: get().items.filter((it) => keyFor(it) !== k), couponCode: null, couponDiscount: 0 });

        if (item) syncRemove(item);
      },

      setQty: (k, qty) => {
        const item = get().items.find((it) => keyFor(it) === k);
        if (item && item.maxQty !== undefined && qty > item.maxQty) {
          toast.error(`Only ${item.maxQty} left in stock`);
          qty = item.maxQty;
        }

        set({
          items: get()
            .items.map((it) => (keyFor(it) === k ? { ...it, qty } : it))
            .filter((it) => it.qty > 0),
          couponCode: null,
          couponDiscount: 0,
        });

        if (item) {
          syncUpdate(item, qty);
        }
      },

      clear: () => {
        set({ items: [], couponCode: null, couponDiscount: 0 });
        syncClear();
      },

      subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
      savings: () => get().items.reduce((s, i) => s + (i.mrp - i.price) * i.qty, 0),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),

      applyCoupon: async (code: string) => {
        try {
          const res = await apiClient.post<{ code: string; discount: number }>(
            "/orders/apply-coupon",
            { code, subtotal: get().subtotal() },
          );
          set({ couponCode: res.code, couponDiscount: res.discount });
          toast.success("Coupon applied");
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Invalid coupon");
          throw err;
        }
      },

      removeCoupon: () => {
        set({ couponCode: null, couponDiscount: 0 });
        toast("Coupon removed");
      },
    }),
    {
      name: "ink-cart",
      // Don't persist drawer-open state — avoids drawer popping on reload
      // and prevents SSR/CSR mismatches.
      partialize: (s) =>
        ({
          items: s.items,
          couponCode: s.couponCode,
          couponDiscount: s.couponDiscount,
        }) as CartState,
    },
  ),
);

export const itemKey = keyFor;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "ink-cart") {
      useCart.persist.rehydrate();
    }
    if (e.key === "ink-cart-sync-queue") {
      useSyncStore.persist.rehydrate();
    }
  });
}
