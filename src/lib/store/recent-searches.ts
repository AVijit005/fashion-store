import { create } from "zustand";
import { persist } from "zustand/middleware";

type State = {
  items: string[];
  push: (q: string) => void;
  clear: () => void;
};

export const useRecentSearches = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      push: (q) => {
        const v = q.trim();
        if (!v) return;
        const next = [v, ...get().items.filter((i) => i.toLowerCase() !== v.toLowerCase())].slice(
          0,
          6,
        );
        set({ items: next });
      },
      clear: () => set({ items: [] }),
    }),
    { name: "ink-recent-searches" },
  ),
);
