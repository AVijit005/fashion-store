import { create } from "zustand";
import { persist } from "zustand/middleware";

type State = {
  ids: string[];
  push: (id: string) => void;
};

export const useRecentlyViewed = create<State>()(
  persist(
    (set, get) => ({
      ids: [],
      push: (id) => {
        const next = [id, ...get().ids.filter((x) => x !== id)].slice(0, 12);
        set({ ids: next });
      },
    }),
    { name: "ink-recently-viewed" },
  ),
);
