// Shared motion identity for Ink Studio.
// One easing token across the storefront, plus reduced-motion helper.

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const DUR = {
  fast: 0.2,
  base: 0.35,
  slow: 0.6,
  cinema: 0.9,
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
