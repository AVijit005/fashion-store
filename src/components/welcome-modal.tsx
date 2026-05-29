import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";

const KEY = "ink-welcome-seen";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid w-full max-w-3xl grid-cols-1 overflow-hidden bg-paper sm:grid-cols-2"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-paper/90 hover:bg-fog"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="hidden bg-fog sm:block">
              <img
                src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80&auto=format&fit=crop"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-8 sm:p-10">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">First visit</p>
              <h2 className="mt-2 font-display text-4xl leading-[0.95] sm:text-5xl">
                10% off your <span className="italic">first piece.</span>
              </h2>
              <p className="mt-3 text-sm text-mute">
                Drop your email for the welcome code, early-access to drops, and the studio
                newsletter.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  close();
                }}
                className="mt-6 flex gap-2"
              >
                <input
                  type="email"
                  required
                  placeholder="you@inkstudio.com"
                  className="flex-1 border border-line bg-transparent px-3 py-3 text-sm outline-none focus:border-ink"
                />
                <button className="bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.22em] text-paper">
                  Claim
                </button>
              </form>
              <button
                onClick={close}
                className="mt-4 text-[12px] uppercase tracking-[0.18em] text-mute hover:text-ink"
              >
                No thanks
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
