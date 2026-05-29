import { create } from "zustand";

export type FlyFlight = {
  id: number;
  src: string;
  from: { x: number; y: number };
};

type State = {
  flights: FlyFlight[];
  target: { x: number; y: number } | null;
  setTarget: (rect: DOMRect | null) => void;
  launch: (src: string, originRect: DOMRect) => void;
  remove: (id: number) => void;
};

let nextId = 1;

export const useFlyToCart = create<State>((set) => ({
  flights: [],
  target: null,
  setTarget: (rect) =>
    set({
      target: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
    }),
  launch: (src, rect) => {
    const flight: FlyFlight = {
      id: nextId++,
      src,
      from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
    set((s) => ({ flights: [...s.flights, flight] }));
  },
  remove: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),
}));
