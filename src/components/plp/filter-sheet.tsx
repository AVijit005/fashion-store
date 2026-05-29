import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Props = {
  children: ReactNode;
  count?: number;
};

// Mobile bottom-sheet wrapper for PLP filters. Desktop keeps its sidebar.
export function FilterSheet({ children, count }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="flex w-full items-center justify-between border border-line bg-paper px-4 py-3 text-[12px] uppercase tracking-[0.18em]">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Filter & sort
            </span>
            {typeof count === "number" && count > 0 && (
              <span className="bg-ink px-2 py-0.5 text-[10px] text-paper">{count}</span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto bg-paper p-0">
          <SheetHeader className="border-b border-line px-5 py-4">
            <SheetTitle className="font-display text-2xl">Filter & sort</SheetTitle>
          </SheetHeader>
          <div className="px-5 py-5">{children}</div>
          <div className="sticky bottom-0 border-t border-line bg-paper p-4">
            <button
              onClick={() => setOpen(false)}
              className="w-full bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
            >
              Show results
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
