import { create } from "zustand";
import { persist } from "zustand/middleware";

type WishlistState = {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({
          ids: get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [...get().ids, id],
        }),
      has: (id) => get().ids.includes(id),
    }),
    { name: "ink-wishlist" },
  ),
);
