import { create } from "zustand";

type State = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

export const useCommandPalette = create<State>((set, get) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
}));
