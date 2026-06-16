import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";

type WishlistState = {
  ids: string[];
  setIds: (ids: string[]) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

// Queue handled optimistically without global variables

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      setIds: (ids) => set({ ids }),
      toggle: (id) => {
        const hasIt = get().ids.includes(id);
        set({
          ids: hasIt ? get().ids.filter((x) => x !== id) : [...get().ids, id],
        });

        if (typeof window !== "undefined") {
          apiClient.post(`/wishlist/${id}/toggle`).catch((e) => {
            import("sonner").then(({ toast }) =>
              toast.error("Failed to sync wishlist with server."),
            );
          });
        }
      },
      has: (id) => get().ids.includes(id),
    }),
    { name: "ink-wishlist" },
  ),
);

export async function syncWishlistOnLogin() {
  try {
    const localIds = useWishlist.getState().ids;
    const initialCount = localIds.length;
    const data = await apiClient.post<string[]>("/wishlist/sync", { productIds: localIds });
    if (Array.isArray(data)) {
      useWishlist.getState().setIds(data);
      if (data.length > initialCount) {
        import("sonner").then(({ toast }) => toast.info("Guest wishlist items synced to account."));
      }
    }
  } catch (err) {
    console.error("Failed to sync wishlist on login", err);
  }
}
