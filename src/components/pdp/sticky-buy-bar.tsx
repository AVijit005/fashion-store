import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { inr } from "@/lib/format";
import { EASE } from "@/lib/motion";

type Props = {
  name: string;
  image: string;
  price: number;
  sizes: string[];
  size: string;
  onSize: (s: string) => void;
  onAdd: () => void;
};

export function StickyBuyBar({ name, image, price, sizes, size, onSize, onAdd }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-paper/95 backdrop-blur-xl shadow-paper lg:bottom-0"
        >
          <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-4 py-3 lg:px-10">
            <img src={image} alt="" className="h-12 w-10 shrink-0 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">{name}</p>
              <p className="text-[12px] tabular-nums text-mute">{inr(price)}</p>
            </div>
            <select
              value={size}
              onChange={(e) => onSize(e.target.value)}
              className="hidden border border-line bg-paper px-3 py-2 text-[12px] uppercase tracking-[0.18em] outline-none focus:border-ink sm:block"
              aria-label="Size"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={onAdd}
              className="flex items-center gap-2 bg-ink px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-paper sm:px-6"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add to bag</span>
              <span className="sm:hidden">Add · {size}</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
