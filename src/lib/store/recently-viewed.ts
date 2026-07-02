import { create } from "zustand";
import { persist } from "zustand/middleware";
import { recentlyViewedApi } from "../api/recently-viewed";
import { useAuthStore } from "./auth";

type State = {
  ids: string[];
  push: (id: string) => void;
  /**
   * Called immediately after a successful login: flushes the
   * localStorage list into the backend so it syncs across devices.
   * Idempotent — safe to call multiple times.
   */
  syncToBackend: () => Promise<void>;
  /**
   * Called by Account / home page when authenticated: replaces the
   * local list with the server-side list so the user sees their
   * cross-device history. No-op when anonymous.
   */
  loadFromBackend: () => Promise<void>;
};

export const useRecentlyViewed = create<State>()(
  persist(
    (set, get) => ({
      ids: [],
      push: (id) => {
        const isAuthed = useAuthStore.getState().isAuthenticated;
        // Always keep the local copy as a fallback (e.g. after logout).
        const next = [id, ...get().ids.filter((x) => x !== id)].slice(0, 12);
        set({ ids: next });

        if (isAuthed) {
          // Fire-and-forget backend tracking; failures are non-fatal —
          // the local copy is the fallback when offline / API down.
          recentlyViewedApi.track(id).catch((err) => {
            console.warn("[recently-viewed] track failed:", err);
          });
        }
      },

      syncToBackend: async () => {
        const { ids } = get();
        if (ids.length === 0) return;
        try {
          await recentlyViewedApi.merge(ids);
          // We keep the local copy as a cache so the PDP "recently viewed"
          // rail still has data during navigation; on next page load the
          // auth store triggers loadFromBackend() to hydrate from server.
        } catch (err) {
          console.warn("[recently-viewed] syncToBackend failed:", err);
        }
      },

      loadFromBackend: async () => {
        if (!useAuthStore.getState().isAuthenticated) return;
        try {
          const list = await recentlyViewedApi.list(12);
          set({ ids: list.map((e) => e.product.id) });
        } catch (err) {
          console.warn("[recently-viewed] loadFromBackend failed:", err);
        }
      },
    }),
    { name: "ink-recently-viewed" },
  ),
);
