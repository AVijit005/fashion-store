import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
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
      },
      remove: (k) => set({ items: get().items.filter((it) => keyFor(it) !== k) }),
      setQty: (k, qty) =>
        set({
          items: get()
            .items.map((it) => (keyFor(it) === k ? { ...it, qty } : it))
            .filter((it) => it.qty > 0),
        }),
      clear: () => set({ items: [] }),
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
