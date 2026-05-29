import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Search, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { useCommandPalette } from "@/lib/store/command-palette";
import { useHydrated } from "@/hooks/use-hydrated";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/wishlist", label: "Saved", icon: Heart },
  { to: "/studio", label: "Studio", icon: Sparkles },
] as const;

export function BottomTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const setCartOpen = useCart((s) => s.setOpen);
  const hydrated = useHydrated();
  const countRaw = useCart((s) => s.count());
  const count = hydrated ? countRaw : 0;
  const openPalette = useCommandPalette((s) => s.setOpen);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        <li>
          <Link
            to="/"
            className="relative flex h-16 min-h-[44px] flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.16em]"
          >
            <Home className={`h-5 w-5 ${path === "/" ? "text-ink" : "text-mute"}`} />
            <span className={path === "/" ? "text-ink" : "text-mute"}>Home</span>
            {path === "/" && (
              <motion.span layoutId="tab-ink" className="absolute inset-x-4 top-0 h-0.5 bg-ink" />
            )}
          </Link>
        </li>
        <li>
          <button
            onClick={() => openPalette(true)}
            className="relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.16em]"
          >
            <Search className="h-5 w-5 text-mute" />
            <span className="text-mute">Search</span>
          </button>
        </li>
        {items.slice(1).map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className="relative flex h-16 min-h-[44px] flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.16em]"
              >
                <Icon className={`h-5 w-5 ${active ? "text-ink" : "text-mute"}`} />
                <span className={active ? "text-ink" : "text-mute"}>{label}</span>
                {active && (
                  <motion.span
                    layoutId="tab-ink"
                    className="absolute inset-x-4 top-0 h-0.5 bg-ink"
                  />
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.16em]"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Cart</span>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="absolute right-3 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] text-paper"
              >
                {count}
              </motion.span>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
