import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function AdminDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-ink/40"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full flex-col bg-paper shadow-2xl"
            style={{ width: `min(${width}px, 100vw)` }}
          >
            <header className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                {eyebrow && (
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
                    {eyebrow}
                  </p>
                )}
                <h2 className="mt-1 font-display text-2xl text-ink">{title}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="flex h-9 w-9 items-center justify-center border border-line bg-paper text-ink transition hover:border-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && (
              <footer className="border-t border-line bg-paper px-5 py-4">{footer}</footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
