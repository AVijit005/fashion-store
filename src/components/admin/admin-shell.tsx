import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { AdminSidebar } from "./sidebar";
import { AdminTopbar } from "./topbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* Desktop sidebar */}
      <div className="hidden w-[248px] shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-[248px]">
          <AdminSidebar />
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative h-full w-[280px] max-w-[85vw] bg-paper"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center border border-line bg-paper"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <AdminSidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
