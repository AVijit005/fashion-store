import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useFlyToCart } from "@/lib/store/fly-to-cart";
import { EASE } from "@/lib/motion";

/**
 * Renders animated thumbnails flying from a product origin to the cart icon.
 * The cart icon must call setTarget(rect) on mount; product cards/PDP call launch().
 */
export function FlyToCartPortal() {
  const { flights, target, remove } = useFlyToCart();

  // Re-measure target on resize/scroll
  useEffect(() => {
    const handler = () => {
      const el = document.querySelector("[data-cart-target]") as HTMLElement | null;
      if (el) useFlyToCart.getState().setTarget(el.getBoundingClientRect());
    };
    handler();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence>
        {flights.map((f) => {
          const tx = (target?.x ?? f.from.x) - f.from.x;
          const ty = (target?.y ?? f.from.y) - f.from.y;
          return (
            <motion.img
              key={f.id}
              src={f.src}
              alt=""
              initial={{ x: f.from.x - 36, y: f.from.y - 48, opacity: 1, scale: 1, rotate: 0 }}
              animate={{
                x: f.from.x - 36 + tx,
                y: f.from.y - 48 + ty,
                opacity: 0,
                scale: 0.2,
                rotate: 18,
              }}
              transition={{ duration: 0.85, ease: EASE }}
              onAnimationComplete={() => remove(f.id)}
              className="absolute h-24 w-[72px] object-cover shadow-ink"
              style={{ left: 0, top: 0 }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
